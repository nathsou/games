// Static assets and the shared friend-invite API live on the same origin.
export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith('/api/')) {
      return Response.json({error:'This API route is unavailable.'},{status:404});
    }
    return env.ASSETS.fetch(request);
  }
};
