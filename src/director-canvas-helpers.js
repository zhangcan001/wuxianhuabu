import { clamp } from "./canvas-viewport-helpers.js";

export const DEFAULT_MANNEQUINS = [
  { id: 1, color: "#e53935", x: -2.4, z: 0, pose: "stand" },
  { id: 2, color: "#20c060", x: 2.4, z: 0, pose: "stand" },
];

export const POSE_PRESETS = {
  stand: { label: "站立", leftArm: 8, rightArm: -8, leftLeg: 2, rightLeg: -2, bodyLean: 0 },
  walk: { label: "行走", leftArm: -34, rightArm: 30, leftLeg: 24, rightLeg: -22, bodyLean: -3 },
  run: { label: "奔跑", leftArm: -62, rightArm: 54, leftLeg: 42, rightLeg: -38, bodyLean: -12 },
  point: { label: "指向", leftArm: 8, rightArm: -88, leftLeg: 4, rightLeg: -6, bodyLean: 0 },
  sit: { label: "坐姿", leftArm: 16, rightArm: -16, leftLeg: 72, rightLeg: -72, bodyLean: 6 },
  fight: { label: "对峙", leftArm: -58, rightArm: 62, leftLeg: -18, rightLeg: 18, bodyLean: -8 },
};

export function makeCanvas(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  draw(ctx, width, height);
  return canvas.toDataURL("image/png");
}

export function makeGeneratedImage(prompt) {
  return makeCanvas(900, 580, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#0dd4c8");
    gradient.addColorStop(0.5, "#2367d8");
    gradient.addColorStop(1, "#10b981");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(54, 54, w - 108, h - 108);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 42px sans-serif";
    ctx.fillText("AI 图片", 90, 130);
    ctx.font = "28px sans-serif";
    wrapText(ctx, prompt, 90, 190, w - 180, 40);
  });
}

export function makeStoryboardImage(rows, cols, frames) {
  return makeCanvas(900, 900, (ctx, w, h) => {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, w, h);
    const cellW = w / cols;
    const cellH = h / rows;
    frames.forEach((frame, index) => {
      const x = (index % cols) * cellW;
      const y = Math.floor(index / cols) * cellH;
      ctx.fillStyle = index % 2 ? "#1b1d22" : "#15171c";
      ctx.fillRect(x + 8, y + 8, cellW - 16, cellH - 16);
      ctx.strokeStyle = "#22d3ee";
      ctx.strokeRect(x + 8, y + 8, cellW - 16, cellH - 16);
      ctx.fillStyle = "#dbeafe";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText(`分镜 ${index + 1}`, x + 34, y + 54);
      ctx.font = "22px sans-serif";
      wrapText(ctx, frame || "依据之前的内容进行推测", x + 34, y + 96, cellW - 68, 32);
    });
  });
}

export function normalizeDirectorCamera(camera = {}) {
  return {
    yaw: typeof camera.yaw === "number" ? camera.yaw : 0,
    pitch: typeof camera.pitch === "number" ? camera.pitch : 12,
    zoom: typeof camera.zoom === "number" ? camera.zoom : 1,
  };
}

export function normalizeMannequins(mannequins) {
  return mannequins.map(normalizeMannequin);
}

export function normalizeMannequin(man) {
  const preset = POSE_PRESETS[man.pose] || POSE_PRESETS.stand;
  return {
    id: man.id,
    color: man.color || "#22d3ee",
    x: typeof man.x === "number" ? man.x : 0,
    z: typeof man.z === "number" ? man.z : 0,
    turn: typeof man.turn === "number" ? man.turn : 0,
    pose: man.pose || "stand",
    leftArm: typeof man.leftArm === "number" ? man.leftArm : preset.leftArm,
    rightArm: typeof man.rightArm === "number" ? man.rightArm : preset.rightArm,
    leftLeg: typeof man.leftLeg === "number" ? man.leftLeg : preset.leftLeg,
    rightLeg: typeof man.rightLeg === "number" ? man.rightLeg : preset.rightLeg,
    bodyLean: typeof man.bodyLean === "number" ? man.bodyLean : preset.bodyLean,
  };
}

export function projectDirectorPoint(point, camera) {
  const yaw = ((camera.yaw || 0) * Math.PI) / 180;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const rx = point.x * cos - point.z * sin;
  const rz = point.x * sin + point.z * cos;
  const pitch = camera.pitch || 0;
  const zoom = camera.zoom || 1;
  return {
    left: clamp(50 + rx * 8.5 * zoom, 8, 92),
    top: clamp(52 + rz * 5.8 * zoom - pitch * 0.24, 18, 88),
    depth: rz,
    scale: clamp((1 + rz * 0.035) * zoom, 0.72, 1.22),
  };
}

export function makeDirectorImage(mannequins, camera = { yaw: 0, pitch: 12, zoom: 1 }) {
  const normalized = normalizeMannequins(mannequins);
  return makeCanvas(1000, 620, (ctx, w, h) => {
    ctx.fillStyle = "#08090b";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,.14)";
    for (let i = 0; i < 18; i += 1) {
      const y = 300 + i * 20 - camera.pitch * 2;
      ctx.beginPath();
      ctx.moveTo(0, y + Math.sin((camera.yaw + i * 8) * Math.PI / 180) * 30);
      ctx.lineTo(w, y + i * 10 - Math.sin((camera.yaw + i * 8) * Math.PI / 180) * 30);
      ctx.stroke();
    }
    normalized
      .sort((a, b) => projectDirectorPoint(a, camera).depth - projectDirectorPoint(b, camera).depth)
      .forEach((man) => {
      const projected = projectDirectorPoint(man, camera);
      const x = (projected.left / 100) * w;
      const baseY = (projected.top / 100) * h + 90 * projected.scale;
      const scale = projected.scale;
      ctx.fillStyle = man.color;
      ctx.beginPath();
      ctx.arc(x, baseY - 170 * scale, 24 * scale, 0, Math.PI * 2);
      ctx.fill();
      drawLimb(ctx, x - 18 * scale, baseY - 130 * scale, 56 * scale, man.leftArm - 8, man.color, 10 * scale);
      drawLimb(ctx, x + 18 * scale, baseY - 130 * scale, 56 * scale, man.rightArm + 8, man.color, 10 * scale);
      ctx.save();
      ctx.translate(x, baseY - 112 * scale);
      ctx.rotate((man.bodyLean * Math.PI) / 180);
      ctx.fillRect(-20 * scale, 0, 40 * scale, 82 * scale);
      ctx.restore();
      drawLimb(ctx, x - 12 * scale, baseY - 32 * scale, 72 * scale, man.leftLeg, man.color, 9 * scale);
      drawLimb(ctx, x + 12 * scale, baseY - 32 * scale, 72 * scale, man.rightLeg, man.color, 9 * scale);
    });
  });
}

export function makeDirectorDepthImage(mannequins, camera = { yaw: 0, pitch: 12, zoom: 1 }) {
  const normalized = normalizeMannequins(mannequins);
  return makeCanvas(1000, 620, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "#050505");
    gradient.addColorStop(0.42, "#2c2c2c");
    gradient.addColorStop(1, "#777777");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 18; i += 1) {
      const y = 300 + i * 20 - camera.pitch * 2;
      const shade = Math.round(clamp(60 + i * 8, 40, 188));
      ctx.strokeStyle = `rgb(${shade}, ${shade}, ${shade})`;
      ctx.beginPath();
      ctx.moveTo(0, y + Math.sin((camera.yaw + i * 8) * Math.PI / 180) * 30);
      ctx.lineTo(w, y + i * 10 - Math.sin((camera.yaw + i * 8) * Math.PI / 180) * 30);
      ctx.stroke();
    }

    normalized
      .sort((a, b) => projectDirectorPoint(a, camera).depth - projectDirectorPoint(b, camera).depth)
      .forEach((man) => {
        const projected = projectDirectorPoint(man, camera);
        const joints = getDirectorPoseJoints(man, camera, w, h);
        const depthShade = Math.round(clamp(205 - (projected.depth + 4) * 20, 38, 230));
        ctx.fillStyle = `rgb(${depthShade}, ${depthShade}, ${depthShade})`;
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineCap = "round";
        ctx.lineWidth = 24 * projected.scale;
        drawDepthBone(ctx, joints.neck, joints.leftHand);
        drawDepthBone(ctx, joints.neck, joints.rightHand);
        drawDepthBone(ctx, joints.hip, joints.leftFoot);
        drawDepthBone(ctx, joints.hip, joints.rightFoot);
        ctx.lineWidth = 42 * projected.scale;
        drawDepthBone(ctx, joints.neck, joints.hip);
        ctx.beginPath();
        ctx.arc(joints.head.x, joints.head.y, 24 * projected.scale, 0, Math.PI * 2);
        ctx.fill();
      });
  });
}

export function makeDirectorPoseImage(mannequins, camera = { yaw: 0, pitch: 12, zoom: 1 }) {
  const normalized = normalizeMannequins(mannequins);
  return makeCanvas(1000, 620, (ctx, w, h) => {
    ctx.fillStyle = "#030405";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(34, 211, 238, 0.16)";
    for (let i = 0; i < 16; i += 1) {
      const y = 320 + i * 18 - camera.pitch * 1.6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + i * 8);
      ctx.stroke();
    }

    normalized
      .sort((a, b) => projectDirectorPoint(a, camera).depth - projectDirectorPoint(b, camera).depth)
      .forEach((man) => {
        const projected = projectDirectorPoint(man, camera);
        const joints = getDirectorPoseJoints(man, camera, w, h);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(5, 7 * projected.scale);
        ctx.strokeStyle = "#ecfeff";
        drawPoseBone(ctx, joints.head, joints.neck);
        drawPoseBone(ctx, joints.neck, joints.hip);
        drawPoseBone(ctx, joints.neck, joints.leftHand);
        drawPoseBone(ctx, joints.neck, joints.rightHand);
        drawPoseBone(ctx, joints.hip, joints.leftFoot);
        drawPoseBone(ctx, joints.hip, joints.rightFoot);

        ctx.fillStyle = man.color;
        Object.values(joints).forEach((joint) => {
          ctx.beginPath();
          ctx.arc(joint.x, joint.y, Math.max(6, 8 * projected.scale), 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.fillStyle = "#c8f7ff";
        ctx.font = `${Math.round(20 * projected.scale)}px sans-serif`;
        ctx.fillText(`#${man.id} ${POSE_PRESETS[man.pose]?.label || "站立"}`, joints.head.x + 18, joints.head.y - 8);
      });
  });
}

function getDirectorPoseJoints(man, camera, width, height) {
  const projected = projectDirectorPoint(man, camera);
  const x = (projected.left / 100) * width;
  const baseY = (projected.top / 100) * height + 90 * projected.scale;
  const scale = projected.scale;
  const lean = ((man.bodyLean || 0) * Math.PI) / 180;
  const shoulder = { x: x + Math.sin(lean) * 18 * scale, y: baseY - 126 * scale };
  const hip = { x: x + Math.sin(lean) * 32 * scale, y: baseY - 36 * scale };
  return {
    head: { x, y: baseY - 170 * scale },
    neck: shoulder,
    hip,
    leftHand: limbEnd(shoulder.x - 18 * scale, shoulder.y + 2 * scale, 64 * scale, man.leftArm - 8),
    rightHand: limbEnd(shoulder.x + 18 * scale, shoulder.y + 2 * scale, 64 * scale, man.rightArm + 8),
    leftFoot: limbEnd(hip.x - 12 * scale, hip.y, 78 * scale, man.leftLeg),
    rightFoot: limbEnd(hip.x + 12 * scale, hip.y, 78 * scale, man.rightLeg),
  };
}

function limbEnd(x, y, length, angle) {
  const radians = (angle * Math.PI) / 180;
  return { x: x + Math.sin(radians) * length, y: y + Math.cos(radians) * length };
}

function drawDepthBone(ctx, from, to) {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function drawPoseBone(ctx, from, to) {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function drawLimb(ctx, x, y, length, angle, color, width) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.fillStyle = color;
  ctx.fillRect(-width / 2, 0, width, length);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const chars = Array.from(text);
  let line = "";
  chars.forEach((char) => {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = char;
      y += lineHeight;
    } else {
      line = test;
    }
  });
  if (line) ctx.fillText(line, x, y);
}
