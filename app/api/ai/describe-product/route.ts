import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { name, description, instructions } = await req.json();
  if (!name) return NextResponse.json({ error: "Falta el nombre del producto" }, { status: 400 });

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-v4.1-flash",
        messages: [
          {
            role: "system",
            content:
              "Escribís descripciones cortas y apetitosas para productos de un menú de restaurante. Máximo 2 frases, sin emojis, en español.",
          },
          {
            role: "user",
            content: `Producto: ${name}${description ? `\nDescripción actual: ${description}` : ""}${instructions ? `\nInstrucciones del usuario: ${instructions}` : ""}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[describe-product] OpenRouter error", res.status, errText);
      return NextResponse.json({ error: "No se pudo generar la descripción" }, { status: 502 });
    }

    const data = await res.json();
    const generated = data.choices?.[0]?.message?.content?.trim();
    if (!generated) return NextResponse.json({ error: "Respuesta vacía de la IA" }, { status: 502 });

    return NextResponse.json({ description: generated });
  } catch (err) {
    console.error("[describe-product] request failed", err);
    return NextResponse.json({ error: "No se pudo generar la descripción" }, { status: 502 });
  }
}
