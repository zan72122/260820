/* camera.js - 単純なピンホールカメラ。橋のスケール感は遠近法で出す */
(function (g) {
  'use strict';
  var NB = g.NB, U = NB.U;

  function Camera() {
    this.pos = [0, 20, 500];
    this.target = [0, 10, 0];
    this.fov = 42 * Math.PI / 180;
    this.w = 1; this.h = 1;
    this.fit = 1;
    this.roll = 0;
    this.f = [0, 0, -1]; this.r = [1, 0, 0]; this.u = [0, 1, 0];
    this.k = 1;
    this._o = { x: 0, y: 0, s: 1, z: 1, vis: false };
  }

  Camera.prototype.viewport = function (w, h) { this.w = w; this.h = h; };

  Camera.prototype.update = function () {
    var p = this.pos, t = this.target;
    var fx = t[0] - p[0], fy = t[1] - p[1], fz = t[2] - p[2];
    var l = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
    fx /= l; fy /= l; fz /= l;
    /* right = f x up */
    var rx = fy * 0 - fz * 1, ry = fz * 0 - fx * 0, rz = fx * 1 - fy * 0;
    var rl = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
    rx /= rl; ry /= rl; rz /= rl;
    /* up = r x f */
    var ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
    if (this.roll) {
      var cs = Math.cos(this.roll), sn = Math.sin(this.roll);
      var nrx = rx * cs + ux * sn, nry = ry * cs + uy * sn, nrz = rz * cs + uz * sn;
      ux = ux * cs - rx * sn; uy = uy * cs - ry * sn; uz = uz * cs - rz * sn;
      rx = nrx; ry = nry; rz = nrz;
    }
    this.f[0] = fx; this.f[1] = fy; this.f[2] = fz;
    this.r[0] = rx; this.r[1] = ry; this.r[2] = rz;
    this.u[0] = ux; this.u[1] = uy; this.u[2] = uz;
    this.k = (this.h * 0.5) / Math.tan(this.fov * 0.5) * this.fit;
  };

  /* 射影。out.s は「1m あたりの画面ピクセル数」 */
  Camera.prototype.pr = function (x, y, z, out) {
    out = out || this._o;
    var p = this.pos;
    var ex = x - p[0], ey = y - p[1], ez = z - p[2];
    var f = this.f, r = this.r, u = this.u;
    var vz = ex * f[0] + ey * f[1] + ez * f[2];
    if (vz < 1.0) { out.vis = false; out.z = vz; return out; }
    var s = this.k / vz;
    out.x = this.w * 0.5 + (ex * r[0] + ey * r[1] + ez * r[2]) * s;
    out.y = this.h * 0.5 - (ex * u[0] + ey * u[1] + ez * u[2]) * s;
    out.s = s; out.z = vz; out.vis = true;
    return out;
  };

  /* 水平線の画面 Y (無限遠の水面) */
  Camera.prototype.horizonY = function () {
    var f = this.f, u = this.u;
    var hx = f[0], hz = f[2];
    var hl = Math.sqrt(hx * hx + hz * hz) || 1;
    hx /= hl; hz /= hl;
    var vy = hx * u[0] + hz * u[2];
    var vz = hx * f[0] + hz * f[2];
    if (vz <= 0.001) return -1e5;
    return this.h * 0.5 - this.k * vy / vz;
  };

  /* 指定した点群が画面に収まるよう画角を自動調整。縦画面でも構図が壊れない */
  Camera.prototype.autoFit = function (pts, mx, my) {
    this.fit = 1;
    for (var pass = 0; pass < 2; pass++) {
      this.update();
      var ex = 0.0001, ey = 0.0001, o = { x: 0, y: 0, s: 1, z: 1, vis: false };
      for (var i = 0; i < pts.length; i++) {
        this.pr(pts[i][0], pts[i][1], pts[i][2], o);
        if (!o.vis) continue;
        ex = Math.max(ex, Math.abs(o.x - this.w * 0.5) / (this.w * 0.5));
        ey = Math.max(ey, Math.abs(o.y - this.h * 0.5) / (this.h * 0.5));
      }
      var need = Math.max(ex / mx, ey / my);
      this.fit = this.fit / need;
    }
    this.fit = U.clamp(this.fit, 0.25, 4);
    this.update();
  };

  NB.Camera = Camera;
})(window);
