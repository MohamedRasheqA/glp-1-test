import { NextResponse } from 'next/server';
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    if (!query) {
      return NextResponse.json({
        status: 'error',
        message: 'No query provided'
      }, { status: 400 });
    }
    console.log('Sending request to LLM API:', query);
    const response = await fetch('http://127.0.0.1:5000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query })
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('LLM API Error:', errorText);
      return NextResponse.json({
        status: 'error',
        message: `LLM API responded with status: ${response.status}`
      }, { status: response.status });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}