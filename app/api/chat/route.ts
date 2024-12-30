// app/api/chat/route.ts
import { NextResponse } from 'next/server';

export const maxDuration = 300;
export const runtime = 'edge';
export async function POST(request: Request) {
  try {
    const { query, persona } = await request.json();
    
    if (!query) {
      return NextResponse.json({
        status: 'error',
        message: 'No message provided'
      }, { status: 400 });
    }

    const response = await fetch('https://medication-assistant-backend.vercel.app/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        persona: persona || 'general_med'
      })
    });

    if (!response.ok) {
      throw new Error(`Flask API responded with status: ${response.status}`);
    }

    // Create a TransformStream to process the SSE data
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    let buffer = '';
    const transform = new TransformStream({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = line.slice(6);
              controller.enqueue(encoder.encode(data + '\n'));
            } catch (error) {
              console.error('Error parsing SSE data:', error);
            }
          }
        }
      },
      flush(controller) {
        if (buffer) {
          if (buffer.startsWith('data: ')) {
            try {
              const data = buffer.slice(6);
              controller.enqueue(encoder.encode(data + '\n'));
            } catch (error) {
              console.error('Error parsing SSE data:', error);
            }
          }
        }
      }
    });

    return new Response(
      response.body?.pipeThrough(transform), {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      }
    );

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
