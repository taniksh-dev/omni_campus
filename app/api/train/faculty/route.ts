import { NextResponse } from 'next/server';
import { imagekit } from '@/lib/imagekit';
import { supabaseServer } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const name = String(form.get('name') || '').trim();
    const batch = String(form.get('batch') || '').trim();
    const branch = String(form.get('branch') || '').trim();
    const file = form.get('image') as File | null;

    if (!name || !batch || !branch || !file) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Derive image_url: prefer ImageKit, otherwise fallback to data URL
    let image_url: string;
    try {
      if (imagekit) {
        const upload = await imagekit.upload({
          file: buffer,
          fileName: `${name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.jpg`,
          folder: '/omnicampus/faculty',
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

    const { data, error } = await supabaseServer
      .from('faculty')
      .insert({ name, batch, branch, image_url })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ faculty: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const useMock = process.env.USE_MOCK_STORAGE === 'true' || !supabaseServer;
    if (useMock) {
      return NextResponse.json({ faculty: [] }, { status: 200 });
    }

    const { data, error } = await supabaseServer
      .from('faculty')
      .select('*');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ faculty: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}