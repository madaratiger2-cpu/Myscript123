import { getStore } from "@netlify/blobs";

export default async (req, context) => {
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    };

    try {
        const store = getStore("lua_scripts");
        const method = req.method;
        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        const raw = url.searchParams.get("raw");

        // GET List
        if (method === "GET" && !id && !raw) {
            const list = await store.list();
            return new Response(JSON.stringify(list.blobs || []), { status: 200, headers });
        }

        // GET Single File
        if (method === "GET" && id) {
            const res = await store.getWithMetadata(id);
            if (!res || !res.data) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
            return new Response(JSON.stringify({ id, content: res.data, filename: res.metadata?.filename || id }), { status: 200, headers });
        }

        // Raw GET (For Pastebin style)
        if (method === "GET" && raw) {
            const content = await store.get(raw);
            if (!content) return new Response("Not found", { status: 404 });
            return new Response(content, { status: 200, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
        }

        const body = await req.json().catch(() => ({}));

        // POST / PUT
        if (method === "POST" || method === "PUT") {
            const targetId = body.id || Math.random().toString(36).substring(2, 10);
            await store.set(targetId, body.content || "", { metadata: { filename: body.filename || "script.lua" } });
            return new Response(JSON.stringify({ id: targetId }), { status: 200, headers });
        }

        // DELETE
        if (method === "DELETE") {
            await store.delete(body.id);
            return new Response(JSON.stringify({ success: true }), { status: 200, headers });
        }

        return new Response(JSON.stringify({ error: "Invalid Request" }), { status: 405, headers });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.stack }), { status: 500, headers });
    }
};
