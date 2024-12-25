import { NextResponse } from 'next/server';

export const maxDuration = 300;

// Define TypeScript interfaces for the expected request and response
interface ChatRequest {
  query: string;
}

interface ChatResponse {
  status: 'success' | 'error';
  message?: string;
  response?: string;
  query?: string;
  query_category?: string;
  timestamp?: string;
  conversation_history?: Array<{
    query: string;
    response: string;
    timestamp: string;
  }>;
}

export async function POST(request: Request): Promise<NextResponse<ChatResponse>> {
  try {
    // Parse request body and validate
    const body = await request.json() as ChatRequest;
    
    if (!body.query?.trim()) {
      return NextResponse.json({
        status: 'error',
        message: 'No query provided'
      }, { status: 400 });
    }

    // Setup request timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 290000); // 290 seconds

    try {
      const response = await fetch('http://127.0.0.1:5000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ query: body.query }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Flask API Error:', errorText);
        throw new Error(`Flask API responded with status: ${response.status}`);
      }

      const data = await response.json() as ChatResponse;

      // Validate response format
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from Flask API');
      }

      return NextResponse.json(data);

    } catch (error) {
      clearTimeout(timeoutId);
      throw error; // Re-throw to be handled by outer catch block
    }

  } catch (error) {
    console.error('API Error:', error);

    // Handle different error types
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json({
          status: 'error',
          message: 'Request timed out'
        }, { status: 408 });
      }

      if (error.name === 'SyntaxError') {
        return NextResponse.json({
          status: 'error',
          message: 'Invalid request format'
        }, { status: 400 });
      }

      return NextResponse.json({
        status: 'error',
        message: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      status: 'error',
      message: 'An unexpected error occurred'
    }, { status: 500 });
  }
}