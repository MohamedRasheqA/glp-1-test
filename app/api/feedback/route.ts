import { NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';

// Connection retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// Configure connection pool with optimized settings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:MteivdRH0V2I@ep-holy-mouse-a5n9cbo9.us-east-2.aws.neon.tech/medi-feedback?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 5000, // Reduced to 5 seconds
  idleTimeoutMillis: 30000,
  max: 10, // Reduced max connections
  maxUses: 7500, // Reset connection after 7500 queries
  statement_timeout: 10000, // 10 second statement timeout
  query_timeout: 10000 // 10 second query timeout
});

// Add error handler to the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit process, just log the error
});

interface FeedbackRequest {
  messageId: string;
  feedback: number;
  messageContent: string;
  timestamp: string;
}

async function executeWithRetry(operation: (client: PoolClient) => Promise<any>): Promise<any> {
  let lastError: Error | null = null;
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    let client: PoolClient | null = null;
    
    try {
      client = await pool.connect();
      return await operation(client);
    } catch (error: any) {
      lastError = error;
      console.error(`Attempt ${retryCount + 1} failed:`, error.message);
      
      // Don't retry on validation errors
      if (error.code === '23505' || error.code === '23502') {
        throw error;
      }
      
      // Wait before retrying, with exponential backoff
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      retryCount++;
    } finally {
      if (client) {
        client.release(true); // Release with error = true to destroy the connection if there was an error
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as FeedbackRequest;
    
    // Validate request body
    if (!body.messageId || typeof body.feedback !== 'number' || ![0, 1].includes(body.feedback)) {
      return NextResponse.json({
        status: 'error',
        message: 'Invalid request body'
      }, { status: 400 });
    }

    const result = await executeWithRetry(async (client) => {
      // Use a transaction for data consistency
      await client.query('BEGIN');
      
      try {
        const query = `
          INSERT INTO message_feedback (
            message_id,
            feedback,
            message_content,
            timestamp
          ) VALUES ($1, $2, $3, $4)
          ON CONFLICT (message_id) 
          DO UPDATE SET 
            feedback = EXCLUDED.feedback,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id, feedback
        `;

        const result = await client.query(query, [
          body.messageId,
          body.feedback,
          body.messageContent,
          body.timestamp
        ]);

        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });

    return NextResponse.json({
      status: 'success',
      message: 'Feedback stored successfully',
      data: result.rows[0]
    });

  } catch (error: any) {
    console.error('Feedback API Error:', error);
    
    // Map specific error codes to appropriate responses
    const errorResponses: Record<string, { message: string, status: number }> = {
      'ETIMEDOUT': { message: 'Database connection timed out', status: 504 },
      'ECONNREFUSED': { message: 'Could not connect to database', status: 503 },
      '23505': { message: 'Duplicate message ID', status: 409 },
      '23502': { message: 'Missing required fields', status: 400 },
      'generic': { message: 'Failed to store feedback', status: 500 }
    };

    const response = errorResponses[error.code] || errorResponses.generic;
    
    return NextResponse.json({
      status: 'error',
      message: response.message,
      code: error.code
    }, { status: response.status });
  }
}