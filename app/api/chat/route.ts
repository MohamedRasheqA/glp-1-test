import { NextResponse } from 'next/server';
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    const { query, persona } = await request.json();
    if (!query) {
      return NextResponse.json({
        status: 'error',
        message: 'No message provided'
      }, { status: 400 });
    }
    console.log('Sending request to Flask API:', query);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 290000);
    const response = await fetch('https://medication-assistant-backend.vercel.app//api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        persona: persona || 'general_med'
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Flask API Error:', errorText);
      throw new Error(`Flask API responded with status: ${response.status}`);
    }
    const data = await response.json();
    // Add error handling for malformed response
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format from Flask API');
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Error:', error);
    // Determine if it's a timeout error
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return NextResponse.json({
      status: 'error',
      message: isTimeout
        ? 'Request timed out'
        : (error instanceof Error ? error.message : 'Internal server error')
    }, {
      status: isTimeout ? 408 : 500
    });
  }
}









