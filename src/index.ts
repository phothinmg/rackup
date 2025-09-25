import _buffer from "node:buffer";
import EventEmitter from "node:events";
import fs from "node:fs";
import inspector from "node:inspector";
import zlib from "node:zlib";
import mesco from "mesco";

function bfo(obj: object) {
  const objStr = JSON.stringify(obj);
  return _buffer.Buffer.byteLength(objStr, "utf8");
}
function reduceByts(obj: object, max: number): object {
  const keys = Object.keys(obj).sort((a, b) => bfo(obj[b]) - bfo(obj[a]));
  const reducedObj: Record<string, unknown> = {};
  let size = 0;
  for (const key of keys) {
    const keySize = bfo(obj[key]);
    if (size + keySize > max) break;
    reducedObj[key] = obj[key];
    size += keySize;
  }
  return reducedObj;
}
class Rackup {
  private _name: string;
  // biome-ignore  lint/suspicious/noExplicitAny : just types def
  private _store: Record<string, any>;
  private _storeDir: string;
  private _filePath: string;
  // biome-ignore   lint/complexity/noBannedTypes : just types def
  private __proto__: {};
  // biome-ignore  lint/suspicious/noExplicitAny : just types def
  private events: EventEmitter<any>;
  private _max: number;
  constructor(name?: string) {
    this._name = name ?? "lwe8_store";
    this._storeDir = ".lwe8_store";
    this._store = {};
    this._filePath = this.setFilePath(this._storeDir, this._name);
    this.__proto__ = {};
    this.events = new EventEmitter();
    this._max = 250000;
    // Events
    this.events.on("bytesLimitOver", this.reducebyts);
    this.events.on("removedFromTempStorage", (key) => {
      inspector.console.log(`The value of ${key} removed from temp storage.`);
    });
    this.events.on("removedFromFileStorag", (key) => {
      inspector.console.log(`The value of ${key} removed from file storage.`);
    });
  }
  private firstWrite() {
    return fs.existsSync(this._filePath);
  }
  private setFilePath(_dir: string, fn: string) {
    const _hex = _buffer.Buffer.from(fn).toString("hex");
    return `${_dir}/$${_hex}.br`;
  }
  private checkDir() {
    if (!fs.existsSync(this._storeDir)) {
      fs.mkdirSync(this._storeDir, { recursive: true });
    }
  }
  getSize() {
    if (fs.existsSync(this._filePath)) {
      return fs.statSync(this._filePath).size;
    }
    return 0;
  }
  // biome-ignore  lint/suspicious/noExplicitAny : just types def
  private getFormFile(): Record<string, any> {
    if (fs.existsSync(this._filePath)) {
      const d = fs.readFileSync(this._filePath);
      const e = zlib.brotliDecompressSync(d);
      return JSON.parse(e.toString());
    }
    return {};
  }
  private getNewStore() {
    const fstore = this.getFormFile();
    const _ss = Object.keys(this._store).length > 0 ? { ...this._store } : {};
    const _fs = Object.keys(fstore).length > 0 ? { ...fstore } : {};
    return { ..._fs, ..._ss };
  }
  // biome-ignore  lint/suspicious/noExplicitAny : just types def
  private _write(obj: Record<string, any>) {
    const b = zlib.brotliCompressSync(JSON.stringify(obj));
    fs.writeFileSync(this._filePath, b);
    this._store = {};
  }
  private reducebyts() {
    const _ns = this.getNewStore();
    return reduceByts(_ns, this._max);
  }
  private emitEvent() {
    const _ns = this.getNewStore();
    const obyts = bfo(_ns);
    if (obyts > this._max) {
      this.events.emit("bytesLimitOver");
    }
  }
  // biome-ignore  lint/suspicious/noExplicitAny : just types def
  set(obj: Record<string, any>): this;
  // biome-ignore  lint/suspicious/noExplicitAny : just types def
  set(key: string, value: any): this;
  // biome-ignore  lint/suspicious/noExplicitAny : just types def
  set(...args: any[]) {
    // biome-ignore  lint/suspicious/noExplicitAny : just types def
    let ns: Record<string, any> = {};
    const _ns = this.getNewStore();
    if (typeof args[0] === "object") {
      ns = { ..._ns, ...args[0] };
    } else {
      _ns[args[0]] = args[1];
      ns = { ..._ns };
    }
    this._store = ns;
    return this;
  }
  get(key: string) {
    const _ns = this.getNewStore();
    return _ns[key] ?? undefined;
  }
  remove(key: string): void;
  remove(...args: string[]): void;
  remove(...args: string[]) {
    const _fs = this.getFormFile();
    for (const key of args) {
      if (Object.keys(this._store).includes(key)) {
        delete this._store[key];
        this.events.emit("removedFromTempStorage", key);
      }
      if (Object.keys(_fs).includes(key)) {
        delete _fs[key];
        this.events.emit("removedFromFileStorage", key);
      }
    }
    if (!mesco(_fs, this.__proto__)) {
      this._write(_fs);
      this.__proto__ = _fs;
    }
  }
  write() {
    if (!this.firstWrite()) {
      const _ns = this.getNewStore();
      this.checkDir();
      this.__proto__ = _ns;
      this._write(_ns);
      this.emitEvent();
    } else {
      const _ns = this.getNewStore();
      if (this.firstWrite() && !mesco(_ns, this.__proto__)) {
        this._write(_ns);
        this.__proto__ = _ns;
        this.emitEvent();
      }
    }
  }
  get store() {
    return this.getNewStore();
  }
  get json() {
    return JSON.stringify(this.getNewStore(), null, 2);
  }
}

export default Rackup;
