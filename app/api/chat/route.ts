// app/api/chat/route.ts
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const persona = searchParams.get('persona') || 'general_med';

    if (!query) {
      return new Response(
        'data: ' + JSON.stringify({
          status: 'error',
          message: 'No query provided'
        }) + '\n\n',
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
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

    // Create transform stream
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    // Process the Flask API response
    const processStream = async () => {
      try {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = new TextDecoder().decode(value);
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.trim() && line.startsWith('data: ')) {
              // Ensure proper SSE format
              await writer.write(encoder.encode(`${line}\n\n`));
            }
          }
        }
      } catch (error) {
        console.error('Stream processing error:', error);
        // Send error message in SSE format
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              status: 'error',
              message: 'Stream processing error'
            })}\n\n`
          )
        );
      } finally {
        await writer.close();
      }
    };

    // Start processing
    processStream();

    // Return the readable stream
    return new Response(stream.readable, {
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
      'data: ' + JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : 'Internal server error'
      }) + '\n\n',
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        },
      }
    );
  }
}
