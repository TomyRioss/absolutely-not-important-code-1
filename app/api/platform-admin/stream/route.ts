import { auth } from "@/lib/auth";
import { getPlatformSnapshot, isPlatformAdmin } from "@/lib/platform-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  if (!(await isPlatformAdmin(session.user.id))) return new Response("Forbidden", { status: 403 });

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const publish = async () => {
        if (closed) return;
        try {
          const snapshot = await getPlatformSnapshot();
          if (!closed) controller.enqueue(encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`));
        } catch {
          if (!closed) controller.enqueue(encoder.encode("event: status\ndata: {\"error\":\"refresh-failed\"}\n\n"));
        }
      };
      const stop = () => {
        closed = true;
        if (timer) clearInterval(timer);
        try { controller.close(); } catch { /* already closed */ }
      };
      request.signal.addEventListener("abort", stop, { once: true });
      void publish();
      timer = setInterval(() => { void publish(); }, 10_000);
    },
    cancel() {
      closed = true;
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
