// app/api/chat/route.ts
import { NextResponse } from 'next/server';
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    if (!query) {
      console.log('No query provided in request');
      return NextResponse.json({
        status: 'error',
        message: 'No query provided'
      }, { status: 400 });
    }

    console.log('Sending request to LLM API:', query);

    try {
      const response = await fetch('http://127.0.0.1:5000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      console.log('LLM API Response Status:', response.status);
      console.log('LLM API Response Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('LLM API Error Response Body:', errorText);
        return NextResponse.json({
          status: 'error',
          message: `LLM API responded with status: ${response.status}`
        }, { status: response.status });
      }

      const data = await response.json();
      console.log('LLM API Response Data:', JSON.stringify(data, null, 2));

      if (data.response) {
        console.log('Successfully received LLM response');
      } else {
        console.warn('Received data from LLM but no response field found');
      }

      return NextResponse.json(data);
    } catch (error: unknown) {
      console.error('Fetch Error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      });
      throw error;
    }
  } catch (error: unknown) {
    console.error('API Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}