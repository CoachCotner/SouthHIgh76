// In-memory stand-in for @netlify/blobs, matching the documented Store API.
const stores = new Map();

class FakeStore {
  constructor(name){ this.name = name; if(!stores.has(name)) stores.set(name, new Map()); }
  get _m(){ return stores.get(this.name); }
  async set(key, value, opts = {}){
    this._m.set(key, { data: value, metadata: opts.metadata ?? {}, etag: String(Math.random()) });
  }
  async setJSON(key, value, opts = {}){ await this.set(key, JSON.stringify(value), opts); }
  async get(key){ const e = this._m.get(key); return e ? e.data : null; }
  async getWithMetadata(key){ const e = this._m.get(key); return e ? { data: e.data, etag: e.etag, metadata: e.metadata } : null; }
  async getMetadata(key){ const e = this._m.get(key); return e ? { etag: e.etag, metadata: e.metadata } : null; }
  async list(opts = {}){
    const prefix = opts.prefix ?? "";
    return { blobs: [...this._m.entries()].filter(([k]) => k.startsWith(prefix)).map(([k,v]) => ({ key: k, etag: v.etag })), directories: [] };
  }
  async delete(key){ this._m.delete(key); }
}

export function getStore(arg){ return new FakeStore(typeof arg === "string" ? arg : arg.name); }
export function getDeployStore(arg){ return getStore(arg); }
export function __reset(){ stores.clear(); }
