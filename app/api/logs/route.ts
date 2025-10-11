import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type DetectionLog = {
  id: string;
  type: 'student' | 'faculty' | 'vehicle' | 'unknown';
  timestamp: string;
  // Student fields
  name?: string;
  enrollment?: string;
  year?: string;
  branch?: string;
  // Faculty fields
  batch?: string;
  // Vehicle fields
  vehicleType?: '2-wheeler' | '4-wheeler' | 'bus';
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const type = searchParams.get('type');

    // If Supabase is not configured, return empty array
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase not configured, returning empty logs');
      return NextResponse.json({ logs: [] });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // For now, return mock data since we don't have actual detection logs table
    // In a real implementation, you would query your detection_logs table
    const mockLogs: DetectionLog[] = [
      {
        id: '1',
        type: 'student',
        name: 'John Doe',
        enrollment: 'CS2021001',
        year: '3rd Year',
        branch: 'Computer Science',
        timestamp: new Date().toISOString(),
      },
      {
        id: '2',
        type: 'faculty',
        name: 'Dr. Smith',
        batch: 'CS Batch 2021',
        branch: 'Computer Science',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
      },
      {
        id: '3',
        type: 'vehicle',
        vehicleType: '2-wheeler',
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
      },
      {
        id: '4',
        type: 'unknown',
        timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(), // 1.5 hours ago
      },
    ];

    // Filter by date if provided
    let filteredLogs = mockLogs;
    if (date) {
      const targetDate = new Date(date);
      filteredLogs = mockLogs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate.toDateString() === targetDate.toDateString();
      });
    }

    // Filter by type if provided and not 'all'
    if (type && type !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.type === type);
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ logs: filteredLogs });

  } catch (error) {
    console.error('Error fetching detection logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch detection logs' },
      { status: 500 }
    );
  }
}

// POST endpoint for creating detection logs (for future use)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // If Supabase is not configured, return error
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // In a real implementation, you would insert into detection_logs table
    // const { data, error } = await supabase
    //   .from('detection_logs')
    //   .insert([{
    //     type: body.type,
    //     timestamp: new Date().toISOString(),
    //     ...body
    //   }])
    //   .select();

    // For now, just return success
    return NextResponse.json({ 
      success: true, 
      message: 'Detection log created successfully' 
    });

  } catch (error) {
    console.error('Error creating detection log:', error);
    return NextResponse.json(
      { error: 'Failed to create detection log' },
      { status: 500 }
    );
  }
}