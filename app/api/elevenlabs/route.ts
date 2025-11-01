import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId = 'JBFqnCBsd6RMkjVDRZzb', modelId = 'eleven_multilingual_v2' } = await request.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY is not configured in environment variables' },
        { status: 500 }
      );
    }

    console.log('ElevenLabs TTS request:', {
      textLength: text.length,
      voiceId,
      modelId,
    });

    // ElevenLabs API呼び出し
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', errorText);
      return NextResponse.json(
        {
          error: 'Failed to generate speech',
          details: errorText,
        },
        { status: response.status }
      );
    }

    // 音声データをBase64に変換
    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    console.log('ElevenLabs TTS success, audio size:', audioBuffer.byteLength, 'bytes');

    return NextResponse.json({
      success: true,
      audioData: {
        mimeType: 'audio/mpeg',
        data: audioBase64,
      },
      voiceId,
      modelId,
    });
  } catch (error: any) {
    console.error('ElevenLabs API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate speech',
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
