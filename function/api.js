import { getStore } from "@netlify/blobs";

export default async (req, context) => {
    // CDN aur Browser dono ke liye strict no-cache headers
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
    };

    try {
        const store = getStore("lua_scripts");
        const url = new URL(req.url);
        const method = req.method;
        const id = url.searchParams.get("id");
        const raw = url.searchParams.get("raw");

        if (method === "GET" && raw) {
            const content = await store.get(raw);
            if (content === null) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
            return new Response(content, { 
                status: 200, 
                headers: { 
                    "Content-Type": "text/plain", 
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "no-cache, no-store" 
                } 
            });
        }

        if (method === "GET") {
            if (id) {
                const res = await store.getWithMetadata(id);
                if (!res || res.data === null) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
                return new Response(JSON.stringify({ id, content: res.data, filename: res.metadata?.filename || id }), { status: 200, headers });
            }
            const list = await store.list();
            return new Response(JSON.stringify(list.blobs || []), { status: 200, headers });
        }

        const body = await req.json();

        if (method === "POST") {
            const newId = Math.random().toString(36).substring(2, 10);
            await store.set(newId, body.content || "", { metadata: { filename: body.filename || "script.lua" } });
            return new Response(JSON.stringify({ id: newId }), { status: 200, headers });
        }

        if (method === "PUT") {
            if (!body.id) return new Response(JSON.stringify({ error: "No ID provided" }), { status: 400, headers });
            await store.set(body.id, body.content || "", { metadata: { filename: body.filename } });
            return new Response(JSON.stringify({ id: body.id }), { status: 200, headers });
        }

        if (method === "DELETE") {
            if (body.id) await store.delete(body.id);
            return new Response(JSON.stringify({ success: true }), { status: 200, headers });
        }

        return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers });

    } catch (error) {
        return new Response(JSON.stringify({ error: "Crashed: " + error.message }), { status: 500, headers });
    }
};
