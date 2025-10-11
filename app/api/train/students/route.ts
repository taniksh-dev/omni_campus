import { NextResponse } from 'next/server';
import { imagekit } from '@/lib/imagekit';
import { supabaseServer } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const name = String(form.get('name') || '').trim();
    const enrollment = String(form.get('enrollment') || '').trim();
    const year = String(form.get('year') || '').trim();
    const branch = String(form.get('branch') || '').trim();
    const file = form.get('image') as File | null;

    if (!name || !enrollment || !year || !branch || !file) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Derive image_url: prefer ImageKit, otherwise fallback to data URL
    let image_url: string;
    try {
      if (imagekit) {
        const upload = await imagekit.upload({
          file: buffer,
          fileName: `${enrollment}-${Date.now()}.jpg`,
          folder: '/omnicampus/students',
        });
        image_url = upload.url;
      } else {
        const mime = file.type || 'image/jpeg';
        const base64 = buffer.toString('base64');
        image_url = `data:${mime};base64,${base64}`;
      }
    } catch (e) {
      const mime = file.type || 'image/jpeg';
      const base64 = buffer.toString('base64');
      image_url = `data:${mime};base64,${base64}`;
    }

    if (!supabaseServer) {
      return NextResponse.json({ error: 'Supabase is not configured on the server' }, { status: 500 });
    }

    // Insert into Supabase
    const { data, error } = await supabaseServer
      .from('students')
      .insert({ name, enrollment, year, branch, image_url })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ student: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const useMock = process.env.USE_MOCK_STORAGE === 'true' || !supabaseServer;
    if (useMock) {
      return NextResponse.json({ students: [] }, { status: 200 });
    }

    const { data, error } = await supabaseServer
      .from('students')
      .select('*');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ students: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const idStr = url.searchParams.get('id');
    const id = idStr ? Number(idStr) : NaN;

    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'Missing or invalid id' }, { status: 400 });
    }

    // Allow mock mode or missing Supabase to return success without DB ops
    const useMock = process.env.USE_MOCK_STORAGE === 'true' || !supabaseServer;
    if (useMock) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const { error } = await supabaseServer
      .from('students')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}