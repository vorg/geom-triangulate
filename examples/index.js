import triangulate from "../index.js";
import { polygonPath, cubePolygons } from "primitive-geometry";

import createContext from "pex-context";
import { mat4 } from "pex-math";
import createGUI from "pex-gui";

const basicVert = /* glsl */ `#version 300 es
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;

in vec3 aPosition;

out vec3 vPositionWorld;

void main () {
  vPositionWorld = (uModelMatrix * vec4(aPosition, 1.0)).xyz;

  gl_Position = uProjectionMatrix * uViewMatrix * vec4(vPositionWorld, 1.0);
}`;
const basicFrag = /* glsl */ `#version 300 es
precision highp float;

in vec3 vPositionWorld;
out vec4 fragColor;

void main() {
  vec3 fdx = vec3(dFdx(vPositionWorld.x), dFdx(vPositionWorld.y), dFdx(vPositionWorld.z));
  vec3 fdy = vec3(dFdy(vPositionWorld.x), dFdy(vPositionWorld.y), dFdy(vPositionWorld.z));
  vec3 normal = normalize(cross(fdx, fdy));
  fragColor = vec4(normal * 0.5 + 0.5, 1.0);
}
`;

const W = 1280;
const H = 720;
const ctx = createContext({
  width: W,
  height: H,
  element: document.querySelector("main"),
  pixelRatio: devicePixelRatio,
});

const getPolygon = (sides) => {
  let path = [];

  for (let i = 0; i <= sides; i++) {
    path.push([
      Math.cos((i * Math.PI * 2) / sides),
      Math.sin((i * Math.PI * 2) / sides),
      0,
    ]);
  }
  return path;
};

const POLYGON_SIDES = 6;

const geometries = {
  polygon: polygonPath({ sides: POLYGON_SIDES }),
  box: cubePolygons(),
};
console.log(geometries);

const triangulatedGeometries = structuredClone(geometries);
triangulatedGeometries.polygon.cells = triangulate(
  triangulatedGeometries.polygon.cells,
  POLYGON_SIDES,
);
triangulatedGeometries.box.cells = triangulate(
  triangulatedGeometries.box.cells,
);

for (let geometry of Object.values(geometries)) {
  geometry.cmdOptions = {
    attributes: {
      aPosition: ctx.vertexBuffer(geometry.positions),
    },
    indices: ctx.indexBuffer(geometry.cells),
  };
}
for (let triangulatedGeometry of Object.values(triangulatedGeometries)) {
  triangulatedGeometry.cmdOptions = {
    attributes: {
      aPosition: ctx.vertexBuffer(triangulatedGeometry.positions),
    },
    indices: ctx.indexBuffer(triangulatedGeometry.cells),
  };
}

const clearCmd = {
  pass: ctx.pass({
    clearColor: [1, 1, 1, 1],
    clearDepth: 1,
  }),
};

const modelMatrix = mat4.create();
const viewMatrix = mat4.create();
const drawCmd = {
  pipeline: ctx.pipeline({
    depthTest: true,
    vert: basicVert,
    frag: basicFrag,
  }),
  uniforms: {
    uProjectionMatrix: mat4.perspective(
      mat4.create(),
      Math.PI / 4,
      W / H,
      0.1,
      100,
    ),
    uViewMatrix: viewMatrix,
    uModelMatrix: modelMatrix,
  },
};

const gui = createGUI(ctx);
const State = {
  triangulate: true,
  pause: false,
  geometry: 0,
  geometries: ["polygon", "box"],
};
gui.addParam("Triangulate", State, "triangulate");
gui.addParam("Pause", State, "pause");
gui.addRadioList(
  "Geometry",
  State,
  "geometry",
  State.geometries.map((name, value) => ({ name, value })),
);

let dt = 0;

ctx.frame(() => {
  if (!State.pause) {
    dt += 0.005;
    mat4.rotate(modelMatrix, dt % 0.02, [0, 1, 0]);
    mat4.lookAt(viewMatrix, [0, Math.sin(dt) * 2, 4], [0, 0, 0], [0, 1, 0]);
  }

  ctx.submit(clearCmd);

  const geometry = (State.triangulate ? triangulatedGeometries : geometries)[
    State.geometries[State.geometry]
  ];

  ctx.submit(drawCmd, geometry.cmdOptions);

  gui.draw();
});
