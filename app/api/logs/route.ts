import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const type = searchParams.get('type');

    if (!supabaseServer) {
      return NextResponse.json({ logs: [] });
    }

    let query = supabaseServer.from('detection_logs').select('*');

    // Filter by date if provided
    if (date) {
      // Create start and end of day in ISO format
      const startOfDay = `${date}T00:00:00.000Z`;
      const endOfDay = `${date}T23:59:59.999Z`;
      query = query.gte('timestamp', startOfDay).lte('timestamp', endOfDay);
    }

    // Filter by type if provided and not 'all'
    if (type && type !== 'all') {
      query = query.eq('type', type);
    }

    const { data, error } = await query.order('timestamp', { ascending: false });

    if (error) {
      console.error('Database error fetching logs:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map database snake_case to frontend camelCase
    const mappedLogs = (data || []).map(log => ({
      ...log,
      vehicleType: log.vehicle_type,
    }));

    return NextResponse.json({ logs: mappedLogs });

  } catch (error) {
    console.error('Error fetching detection logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch detection logs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Extract fields and map vehicleType
    const { 
      type, 
      name, 
      enrollment, 
      year, 
      branch, 
      batch, 
      vehicleType, 
      image_url 
    } = body;

    const { data, error } = await supabaseServer
      .from('detection_logs')
      .insert([{
        type,
        name,
        enrollment,
        year,
        branch,
        batch,
        vehicle_type: vehicleType,
        image_url,
        timestamp: new Date().toISOString()
      }])
      .select();

    if (error) {
      console.error('Database error creating log:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Detection log created successfully',
      log: data?.[0]
    });

  } catch (error) {
    console.error('Error creating detection log:', error);
    return NextResponse.json(
      { error: 'Failed to create detection log' },
      { status: 500 }
    );
  }
}