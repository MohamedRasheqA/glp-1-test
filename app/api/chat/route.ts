// app/api/chat/route.ts
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// Helper function to create SSE message
const createSSEMessage = (data: any) => {
  return `data: ${JSON.stringify(data)}\n\n`;
};

export async function POST(request: Request) {
  try {
    const { query, persona = 'general_med' } = await request.json();

    if (!query) {
      return new Response(
        createSSEMessage({
          status: 'error',
          message: 'No query provided'
        }),
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Access-Control-Allow-Origin': '*'
          },
        }
      );
    }

    const FLASK_API_URL = "https://medication-assistant-backend.vercel.app";

    const response = await fetch(`${FLASK_API_URL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, persona })
    });

    if (!response.ok) {
      throw new Error(`Flask API responded with status: ${response.status}`);
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new TransformStream({
      async transform(chunk, controller) {
        const text = decoder.decode(chunk);
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (line.trim() && line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(5));
              controller.enqueue(encoder.encode(createSSEMessage(data)));
            } catch (error) {
              console.error('Error parsing stream data:', error);
            }
          }
        }
      }
    });

    return new Response(response.body?.pipeThrough(stream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no'
      }
    });

  } catch (error) {
    return new Response(
      createSSEMessage({
        status: 'error',
        message: error instanceof Error ? error.message : 'Internal server error'
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}

