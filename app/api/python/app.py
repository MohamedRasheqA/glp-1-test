import requests
import json
from typing import Dict, Any, Optional, Generator, List, ClassVar
import os
from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime
import openai
import io
import base64
import logging
from openai import OpenAI
import numpy as np
import cv2
from PIL import Image

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000"],
        "methods": ["POST", "GET", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

load_dotenv()

# Food Analysis Labels
LABELS = ["Clearly Healthy", "Borderline", "Mixed", "Clearly Unhealthy"]

class EnhancedFoodAnalyzer:
    def __init__(self, openai_client: OpenAI):
        self.client = openai_client
        self.logger = logging.getLogger(__name__)

    def segment_image(self, image_data: bytes) -> List[np.ndarray]:
        """
        Segment the image into individual food portions using contour detection
        """
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur with larger kernel for your plate type
        blurred = cv2.GaussianBlur(gray, (11, 11), 0)
        
        # Use Canny edge detection instead of adaptive threshold
        edges = cv2.Canny(blurred, 50, 150)
        
        # Dilate edges to connect components
        kernel = np.ones((5,5), np.uint8)
        dilated = cv2.dilate(edges, kernel, iterations=1)
        
        # Find contours
        contours, _ = cv2.findContours(
            dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        
        # Filter contours based on area and create segments
        min_area = 500  # Reduced minimum area to catch smaller portions
        food_segments = []
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > min_area:
                # Create a mask for this contour
                mask = np.zeros_like(gray)
                cv2.drawContours(mask, [contour], -1, 255, -1)
                
                # Extract the segment
                segment = cv2.bitwise_and(img, img, mask=mask)
                
                # Get bounding rectangle
                x, y, w, h = cv2.boundingRect(contour)
                cropped_segment = segment[y:y+h, x:x+w]
                
                # Only add non-empty segments
                if cropped_segment.any():
                    food_segments.append(cropped_segment)
        
        return food_segments

    def analyze_segment(self, segment: np.ndarray) -> Dict[str, Any]:
        """
        Analyze a single food segment using GPT-4 Vision
        """
        try:
            # Convert numpy array to bytes
            is_success, buffer = cv2.imencode(".jpg", segment)
            if not is_success:
                raise ValueError("Failed to encode image")
            
            # Convert to base64
            base64_image = base64.b64encode(buffer).decode('utf-8')
            
            # Simple prompt
            prompt = """Analyze this food segment and provide:
1. Food item identification
2. Estimated nutritional values
3. Health category (Healthy/Moderate/Unhealthy)
4. Brief health notes

Format as JSON:
{
    "food_item": "",
    "nutrition": {
        "calories": 0,
        "protein": 0,
        "carbs": 0,
        "fat": 0
    },
    "health_category": "",
    "health_notes": ""
}"""

            # Get analysis from GPT-4 Vision
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": prompt
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=500
            )
            
            # Parse the response
            analysis = json.loads(response.choices[0].message.content)
            return analysis
            
        except Exception as e:
            self.logger.error(f"Error analyzing segment: {str(e)}")
            return {
                "error": str(e),
                "food_item": "Unknown",
                "nutrition": {
                    "calories": 0,
                    "protein": 0,
                    "carbs": 0,
                    "fat": 0
                }
            }

    def combine_analyses(self, segment_analyses: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Combine individual segment analyses into a comprehensive plate analysis
        """
        total_nutrition = {
            "calories": 0,
            "protein": 0,
            "carbs": 0,
            "fiber": 0,
            "fat": 0
        }
        
        all_nutrients = set()
        all_benefits = set()
        all_concerns = set()
        all_allergens = set()
        cuisine_types = set()
        
        food_items = []
        health_categories = []
        
        # First, list all identified foods
        plate_contents = []
        
        for analysis in segment_analyses:
            if "error" not in analysis:
                # Collect food identifications
                if "identification" in analysis:
                    food_info = analysis["identification"]
                    plate_contents.append({
                        "name": food_info["food_name"],
                        "preparation": food_info["preparation"],
                        "serving": food_info["serving_size"]
                    })
                
                # Add nutritional values
                nutrition = analysis.get("nutrition", {})
                for key in total_nutrition:
                    total_nutrition[key] += nutrition.get(key, 0)
                
                # Collect unique nutrients
                all_nutrients.update(nutrition.get("key_nutrients", []))
                
                # Collect health insights
                if "health_profile" in analysis:
                    health_categories.append(analysis["health_profile"]["category"])
                    all_benefits.update(analysis["health_profile"].get("benefits", []))
                    all_concerns.update(analysis["health_profile"].get("concerns", []))
                
                # Collect dietary info
                if "dietary_info" in analysis:
                    all_allergens.update(analysis["dietary_info"].get("allergens", []))
                    if analysis["dietary_info"].get("cuisine_type"):
                        cuisine_types.add(analysis["dietary_info"]["cuisine_type"])
        
        # Determine overall health category
        health_category_counts = {
            "Healthy": health_categories.count("Healthy"),
            "Moderate": health_categories.count("Moderate"),
            "Unhealthy": health_categories.count("Unhealthy")
        }
        
        overall_category = max(health_category_counts.items(), key=lambda x: x[1])[0]
        
        return {
            "plate_overview": {
                "items": plate_contents,
                "cuisine_types": list(cuisine_types)
            },
            "total_nutrition": total_nutrition,
            "overall_health_category": overall_category,
            "nutritional_highlights": {
                "key_nutrients": list(all_nutrients),
                "health_benefits": list(all_benefits),
                "health_concerns": list(all_concerns),
                "allergens": list(all_allergens)
            },
            "individual_analyses": segment_analyses,
            "analysis_timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

class UserProfileManager:
    def __init__(self, openai_client: OpenAI):
        self.client = openai_client
        self.system_instructions = {
            "personal_info": """
            You are a medical system assistant collecting personal information.
            
            OBJECTIVE:
            Extract personal information from user input, focusing on three key fields:
            1. name
            2. age
            3. location

            RULES:
            1. Only extract information that is explicitly stated
            2. Format response as JSON: {"name": "", "age": "", "location": ""}
            3. If a field is missing, leave it empty
            4. For age, only accept numeric values
            """,

            "medical_info": """
            You are a medical system assistant collecting information about a patient's condition.
            
            OBJECTIVE:
            Extract medical information from user input, focusing on three key fields:
            1. diagnosis
            2. concern
            3. target

            RULES:
            1. Only extract information that is explicitly stated
            2. Format response as JSON: {"diagnosis": "", "concern": "", "target": ""}
            3. If a field is missing, leave it empty
            4. Keep medical terminology as stated by the user
            """
        }

    def process_user_input(self, user_input: str, info_type: str) -> Dict[str, str]:
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": self.system_instructions[info_type]},
                    {"role": "user", "content": user_input}
                ]
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Error processing input: {str(e)}")
            return {}

class HealthAssistant:
    _instance: ClassVar[Optional['HealthAssistant']] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.initialized = False
        return cls._instance
    
    def __init__(self):
        """Initialize both GLP-1 and Food Analysis capabilities"""
        if self.initialized:
            return
            
        # GLP-1 Configuration
        self.pplx_api_key = os.getenv('PPLX_API_KEY')
        if not self.pplx_api_key:
            raise ValueError("PPLX API key not provided")
        
        self.pplx_model = "llama-3.1-sonar-large-128k-online"
        self.pplx_headers = {
            "Authorization": f"Bearer {self.pplx_api_key}",
            "Content-Type": "application/json"
        }
        
        # Keep the system prompt
        self.pplx_system_prompt = """
You are a specialized medical information assistant focused EXCLUSIVELY on GLP-1 medications (such as Ozempic, Wegovy, Mounjaro, etc.) and healthy eating habits. You must:

1. ONLY provide information about GLP-1 medications and directly related topics, including dietary recommendations
2. For any query not specifically about GLP-1 medications or their direct effects, respond with:
   "I apologize, but I can only provide information about GLP-1 medications and related topics. Your question appears to be about something else. Please ask a question specifically about GLP-1 medications, their usage, effects, or related concerns."

3. For valid GLP-1 queries, structure your response with:
   - An empathetic opening acknowledging the patient's situation
   - Clear, validated medical information about GLP-1 medications
   - Important safety considerations or disclaimers
   - An encouraging closing that reinforces their healthcare journey

4. Provide response in a simple manner that is easy to understand at preferably a 11th grade literacy level with reduced pharmaceutical or medical jargon
5. Always Return sources in a hyperlink format
"""
        
        # Initialize OpenAI client and food analyzer
        self.openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        if not os.getenv('OPENAI_API_KEY'):
            raise ValueError("OpenAI API key not provided")
        
        self.food_analyzer = EnhancedFoodAnalyzer(self.openai_client)
        
        # Add conversation history management
        self.conversation_history = []
        self.max_history_length = 5
        
        self.initialized = True

    def get_glp1_response(self, query: str) -> Dict[str, Any]:
        """Get response for GLP-1 related queries"""
        try:
            if not query.strip():
                return {
                    "status": "error",
                    "message": "Please enter a valid question."
                }
            
            response = self.get_pplx_response(query)
            return response
            
        except Exception as e:
            logger.error(f"Error in get_glp1_response: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }

    def get_pplx_response(self, query: str) -> Dict[str, Any]:
        """Get response while maintaining conversation context"""
        try:
            # Build messages including conversation history
            messages = [
                {"role": "system", "content": self.pplx_system_prompt}
            ]
            
            # Add conversation history
            for exchange in self.conversation_history:
                messages.append({"role": "user", "content": exchange["query"]})
                messages.append({"role": "assistant", "content": exchange["response"]})
            
            # Add current query
            messages.append({
                "role": "user", 
                "content": f"{query}\n\nPlease include sources for the information provided, formatted as 'Title: URL' on separate lines."
            })
            
            logger.info(f"Sending request with messages: {messages}")  # Debug log
            
            payload = {
                "model": self.pplx_model,
                "messages": messages,
                "temperature": 0.1,
                "max_tokens": 1500
            }
            
            response = requests.post(
                "https://api.perplexity.ai/chat/completions",
                headers=self.pplx_headers,
                json=payload
            )
            
            logger.info(f"API Response status: {response.status_code}")  # Debug log
            
            response.raise_for_status()
            response_data = response.json()
            content = response_data['choices'][0]['message']['content']
            
            # Update conversation history
            self.conversation_history.append({
                "query": query,
                "response": content,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            
            # Maintain history size
            if len(self.conversation_history) > self.max_history_length:
                self.conversation_history.pop(0)
            
            logger.info(f"Generated response: {content[:100]}...")  # Debug log
            
            return {
                "status": "success",
                "query": query,
                "query_category": self.categorize_query(query),
                "response": content.strip(),
                "disclaimer": "Always consult your healthcare provider before making any changes to your medication or treatment plan.",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "conversation_history": self.conversation_history
            }
            
        except Exception as e:
            logger.error(f"Error in get_pplx_response: {str(e)}")
            return {
                "status": "error",
                "query": query,
                "query_category": "error",
                "response": f"An error occurred: {str(e)}",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
    
    def clear_conversation_history(self):
        """Clear the conversation history"""
        self.conversation_history = []
    
    def get_conversation_history(self) -> List[Dict[str, Any]]:
        """Get the current conversation history"""
        return self.conversation_history

    def analyze_food(self, image_data) -> Dict[str, Any]:
        """Analyze food image for comprehensive health assessment"""
        try:
            # Convert to base64
            base64_image = base64.b64encode(image_data).decode('utf-8')
            
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": """You are a nutritional analysis expert. Provide a comprehensive analysis of the food image.:

1. Health Category: Classify as one of:
   - Clearly Healthy
   - Borderline
   - Mixed
   - Clearly Unhealthy

2. Confidence Score: Provide a confidence level (0-100%)

3. Detailed Analysis:
   Break down the following aspects:
   - Food name: Identify the food item
   - Caloric Content: Analyze the caloric density and impact
   - Macronutrients: Evaluate proteins, fats, carbohydrates present
   - Processing Level: Assess how processed the foods are
   - Nutritional Profile: Identify key nutrients present or lacking
   - Health Implications: Discuss potential health effects
   - Portion Considerations: Comment on serving sizes if relevant

4. Summary: Conclude with overall health impact and recommendations

Format your response exactly as:
Category: [category]
Confidence: [number]%
Analysis:
[Provide detailed analysis]
[Include specific items from the image in your analysis]
[Importantly, is any of the above aspects not applicable to the image mean please leave it that aspects in response ]
[End with a summary statement]"""
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=1000
            )
            
            # Parse the response
            analysis_text = response.choices[0].message.content
            
            # Extract information using string parsing
            lines = analysis_text.split('\n')
            
            # Initialize variables
            category = ""
            confidence = 0
            analysis = []
            current_section = ""

            # Parse the response more comprehensively
            for line in lines:
                if line.startswith('Category:'):
                    category = line.split(':', 1)[1].strip()
                elif line.startswith('Confidence:'):
                    confidence = float(line.split(':', 1)[1].strip().replace('%', ''))
                elif line.startswith('Analysis:'):
                    current_section = "analysis"
                elif current_section == "analysis":
                    analysis.append(line.strip())

            # Join analysis lines with proper formatting
            analysis_text = '\n'.join(analysis)
            
            return {
                "status": "success",
                "category": category,
                "confidence": confidence,
                "analysis": analysis_text,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            
        except Exception as e:
            logger.error(f"Error in analyze_food: {str(e)}")
            return {
                "status": "error",
                "message": str(e),
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

    def categorize_query(self, query: str) -> str:
        """Categorize the user query"""
        categories = {
            "dosage": ["dose", "dosage", "how to take", "when to take", "injection", "administration"],
            "side_effects": ["side effect", "adverse", "reaction", "problem", "issues", "symptoms"],
            "benefits": ["benefit", "advantage", "help", "work", "effect", "weight", "glucose"],
            "storage": ["store", "storage", "keep", "refrigerate", "temperature"],
            "lifestyle": ["diet", "exercise", "lifestyle", "food", "alcohol", "eating"],
            "interactions": ["interaction", "drug", "medication", "combine", "mixing"],
            "cost": ["cost", "price", "insurance", "coverage", "afford"]
        }
        
        query_lower = query.lower()
        for category, keywords in categories.items():
            if any(keyword in query_lower for keyword in keywords):
                return category
        return "general"

# Flask routes
@app.route('/')
@app.route('/database')
def serve_spa():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        query = data.get('query')
        
        if not query:
            return jsonify({
                "status": "error",
                "message": "No query provided"
            }), 400

        assistant = HealthAssistant()  # Will return the singleton instance
        response = assistant.get_glp1_response(query)
        
        logger.info(f"Chat response: {response}")  # Debug log
        
        return jsonify(response)

    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/analyze-food', methods=['POST'])
def analyze_food():
    try:
        if 'image' not in request.files:
            return jsonify({
                "status": "error",
                "message": "No image file provided"
            }), 400

        image_file = request.files['image']
        image_data = image_file.read()
        
        assistant = HealthAssistant()
        response = assistant.analyze_food(image_data)
        
        return jsonify(response)

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/calculator', methods=['POST'])
def analyze_image():
    try:
        data = request.json
        if not data or 'image' not in data:
            logger.error("No image data in request")
            return jsonify({
                'status': 'error',
                'message': 'No image data provided'
            }), 400

        # Get base64 image data
        image_data = base64.b64decode(data['image'].split(',')[1])
        
        # Process image using HealthAssistant
        health_assistant = HealthAssistant()
        result = health_assistant.analyze_food(image_data)
        
        logger.info(f"Image analysis completed: {result}")
        
        return jsonify(result)  # Return the result directly

    except Exception as e:
        logger.error(f"Error in analyze_image: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'}), 200

@app.route('/api/profile/personal', methods=['POST'])
def process_personal_info():
    try:
        data = request.get_json()
        user_input = data.get('input')
        
        if not user_input:
            return jsonify({
                "status": "error",
                "message": "No input provided"
            }), 400

        openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        profile_manager = UserProfileManager(openai_client)
        result = profile_manager.process_user_input(user_input, "personal_info")
        
        return jsonify({
            "status": "success",
            "data": result
        })

    except Exception as e:
        logger.error(f"Error in process_personal_info: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/profile/medical', methods=['POST'])
def process_medical_info():
    try:
        data = request.get_json()
        user_input = data.get('input')
        
        if not user_input:
            return jsonify({
                "status": "error",
                "message": "No input provided"
            }), 400

        openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        profile_manager = UserProfileManager(openai_client)
        result = profile_manager.process_user_input(user_input, "medical_info")
        
        return jsonify({
            "status": "success",
            "data": result
        })

    except Exception as e:
        logger.error(f"Error in process_medical_info: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

# Add new route for chat history
@app.route('/api/chat-history', methods=['GET'])
def get_chat_history():
    try:
        assistant = HealthAssistant()
        history = assistant.get_chat_history()
        
        return jsonify({
            "status": "success",
            "history": history
        })

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    print("Starting Flask server on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
