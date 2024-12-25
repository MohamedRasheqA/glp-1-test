import { NextResponse } from 'next/server';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export async function POST(request: Request) {
  try {
    const { image } = await request.json();
    
   
    
    console.log('Sending request to backend...');
    const response = await fetch(`http://127.0.0.1:5000/api/calculator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ image }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      throw new Error(`Backend error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('Backend response:', result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to analyze image',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    
    const response = await fetch(`https://glp-1-xplo.vercel.app/api/calaculator`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Backend server is not responding');
    }

    const data = await response.json();
    return NextResponse.json({ status: data.status });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Backend server is not available'
      },
      { status: 503 }
    );
  }
}
