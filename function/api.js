import { getStore } from "@netlify/blobs";

export default async (req, context) => {
    // Super strict Anti-Cache Headers (Netlify CDN ko bypass karne ke liye)
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
        "Surrogate-Control": "no-store" // Sabse zaroori: Netlify Edge cache block karne ke liye
    };

    try {
        const store = getStore("lua_scripts");
        const url = new URL(req.url);
        const method = req.method;
        const id = url.searchParams.get("id");
        const raw = url.searchParams.get("raw");

        // 1. RAW VIEW (For Pastebin style link / Executing Script)
        if (method === "GET" && raw) {
            const content = await store.get(raw);
            if (content === null) return new Response("Error: Script not found", { status: 404 });
            
            return new Response(content, { 
                status: 200, 
                headers: { 
                    "Content-Type": "text/plain; charset=utf-8", 
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                    "Surrogate-Control": "no-store"
                } 
            });
        }

        // 2. GET SINGLE FILE (Edit karne ke liye data lana)
        if (method === "GET" && id) {
            const res = await store.getWithMetadata(id);
            if (!res || res.data === null) {
                return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
            }
            return new Response(JSON.stringify({ 
                id: id, 
                content: res.data, 
                filename: res.metadata?.filename || id 
            }), { status: 200, headers });
        }

        // 3. GET FULL LIST (Dashboard par sabhi scripts dikhane ke liye)
        if (method === "GET") {
            const list = await store.list();
            // Ensure we always return an array, even if blobs is undefined
            return new Response(JSON.stringify(list.blobs || []), { status: 200, headers });
        }

        // POST/PUT/DELETE ke liye Body read karna
        const body = await req.json().catch(() => ({}));

        // 4. UPLOAD NEW SCRIPT (POST)
        if (method === "POST") {
            // Random 8 character ID generate karna
            const targetId = Math.random().toString(36).substring(2, 10);
            const filename = body.filename || `script_${targetId}.lua`;
            
            await store.set(targetId, body.content || "", { metadata: { filename } });
            return new Response(JSON.stringify({ id: targetId }), { status: 200, headers });
        }

        // 5. EDIT & SAVE SCRIPT (PUT)
        if (method === "PUT") {
            if (!body.id) return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400, headers });
            
            await store.set(body.id, body.content || "", { metadata: { filename: body.filename } });
            return new Response(JSON.stringify({ id: body.id }), { status: 200, headers });
        }

        // 6. DELETE SCRIPT (DELETE)
        if (method === "DELETE") {
            if (body.id) await store.delete(body.id);
            return new Response(JSON.stringify({ success: true }), { status: 200, headers });
        }

        // Agar koi aur request aati hai (like PATCH, OPTIONS)
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers });

    } catch (error) {
        // Agar kuch crash ho gaya to exact error frontend pe dikhega
        return new Response(JSON.stringify({ error: "Backend Crash: " + error.message }), { status: 500, headers });
    }
};
