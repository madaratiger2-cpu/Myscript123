import { getStore } from "@netlify/blobs";

export default async (req, context) => {
    const store = getStore("lua_scripts");
    const method = req.method;
    const url = new URL(req.url);
    
    // URL se id aur raw parameters nikalna
    const id = url.searchParams.get("id");
    const raw = url.searchParams.get("raw");

    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
    };

    try {
        if (method === "GET" && raw) {
            const content = await store.get(raw);
            if (content === null) {
                return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
            }
            return new Response(content, { 
                status: 200, 
                headers: { 
                    "Content-Type": "text/plain; charset=utf-8", 
                    "Cache-Control": "no-cache", 
                    "Access-Control-Allow-Origin": "*" 
                } 
            });
        }

        if (method === "GET") {
            if (id) {
                const res = await store.getWithMetadata(id);
                if (!res || res.data === null) {
                    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
                }
                return new Response(JSON.stringify({ 
                    id, 
                    content: res.data, 
                    filename: res.metadata?.filename || id 
                }), { status: 200, headers });
            }
            
            const { blobs } = await store.list();
            return new Response(JSON.stringify(blobs), { status: 200, headers });
        }

        if (method === "POST") {
            const body = await req.json();
            const newId = Math.random().toString(36).substring(2, 10);
            const filename = body.filename || `script_${newId}.lua`;
            await store.set(newId, body.content || "", { metadata: { filename } });
            return new Response(JSON.stringify({ id: newId }), { status: 200, headers });
        }

        if (method === "PUT") {
            const body = await req.json();
            // Bug fix: Ab empty file (blank string) ko invalid nahi maanega
            if (!body.id || typeof body.content !== "string") {
                return new Response(JSON.stringify({ error: "Invalid data" }), { status: 400, headers });
            }
            await store.set(body.id, body.content, { metadata: { filename: body.filename } });
            return new Response(JSON.stringify({ id: body.id }), { status: 200, headers });
        }

        if (method === "DELETE") {
            const body = await req.json();
            if (body.id) await store.delete(body.id);
            return new Response(JSON.stringify({}), { status: 200, headers });
        }

        return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers });
        
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    }
};
