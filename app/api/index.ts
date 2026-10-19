// Vercel serverless entry. All /api/* requests are rewritten here (see vercel.json).
import handleApi from "../server/api.js";

export default handleApi;
