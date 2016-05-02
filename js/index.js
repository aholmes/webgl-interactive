/// <reference path="typings/gl-matrix.d.ts" />
var Shape;
(function (Shape) {
    Shape[Shape["Cube"] = 0] = "Cube";
    Shape[Shape["Sphere"] = 1] = "Sphere";
})(Shape || (Shape = {}));
var App = (function () {
    function App(canvas) {
        var _this = this;
        this._definedColors = [
            [1.0, 1.0, 1.0, 1.0],
            [1.0, 0.0, 0.0, 1.0],
            [0.0, 1.0, 0.0, 1.0],
            [0.0, 0.0, 1.0, 1.0],
            [1.0, 1.0, 0.0, 1.0],
            [1.0, 0.0, 1.0, 1.0] // Left face: purple
        ];
        this._events = {};
        this._mouseIsDown = false;
        this._animating = false;
        this._canvas = canvas;
        this._ctx = canvas.getContext('webgl');
        this._canvas.setAttribute('width', this._canvas.clientWidth.toString());
        this._canvas.setAttribute('height', this._canvas.clientHeight.toString());
        this._ctx.viewport(0, 0, canvas.width, canvas.height);
        this._config =
            {
                DrawMode: this._ctx.TRIANGLES,
                Quality: 3,
                ZoomLevel: -4.0,
                Rotation: {
                    X: 0,
                    Y: 0,
                    Z: 0
                },
                Shape: Shape.Cube
            };
        this._pageX = canvas.width / 2;
        this._pageY = canvas.height / 2;
        document.captureEvents(Event.MOUSEMOVE);
        this._events['mousedown'] = function (e) { return _this._mouseUpDownHandler(e); };
        this._events['mouseup'] = function (e) { return _this._mouseUpDownHandler(e); };
        this._events['mousemove'] = function (e) { return _this._mouseMoveHandler(e); };
        this._canvas.addEventListener('mousedown', this._events['mousedown']);
        this._canvas.addEventListener('mouseup', this._events['mouseup']);
        document.addEventListener('mousemove', this._events['mousemove']);
    }
    App.prototype._mouseUpDownHandler = function (e) {
        this._mouseIsDown = !this._mouseIsDown;
    };
    App.prototype._mouseMoveHandler = function (e) {
        this._pageX = e.pageX;
        this._pageY = e.pageY;
    };
    App.prototype._generateColors = function (vertices, indices, solid) {
        if (solid === void 0) { solid = true; }
        var colors = [];
        var outerIterations = solid === true
            ? this._faceLength
            : (this._faceLength * this._facePointLength);
        var innerIterations = solid === true
            ? this._facePointLength
            : 1;
        for (var i = 0; i < outerIterations; i++) {
            var color = this._definedColors[(i + 1) % this._definedColors.length];
            // set the same color for each vertex so the face will be drawn as a solid color
            for (var j = 0; j < innerIterations; j++) {
                colors = colors.concat(color);
            }
        }
        // returns one RGBA for each INDEX
        return colors;
    };
    App.prototype._animate = function (proj_matrix, view_matrix, mov_matrix) {
        var _this = this;
        if (this._animating)
            return;
        this._animating = true;
        var ctx = this._ctx;
        var rotThetas = this._config.Rotation;
        var timeThen = 0;
        var zoomLevel_old = 0;
        var halfCanvasWidth = this._canvas.width / 2;
        var halfCanvasHeight = this._canvas.height / 2;
        ctx.enable(ctx.DEPTH_TEST);
        ctx.depthFunc(ctx.LEQUAL);
        ctx.clearDepth(1.0);
        ctx.viewport(0.0, 0.0, this._canvas.width, this._canvas.height);
        ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);
        var angle = 0;
        var execAnimation = function () {
            var timeNow = new Date().getTime();
            if (timeThen !== 0) {
                angle += 0.05 * (timeNow - timeThen);
            }
            timeThen = timeNow;
            var x = (_this._pageX - halfCanvasWidth) / halfCanvasWidth;
            var y = (_this._pageY - halfCanvasHeight) / halfCanvasHeight;
            mat4.rotateX(mov_matrix, mov_matrix, y * 0.05);
            mat4.rotateY(mov_matrix, mov_matrix, x * 0.05);
            for (var axis in rotThetas) {
                var theta = rotThetas[axis];
                if (theta > 0.0 || theta < 0.0) {
                    mat4[("rotate" + axis)](mov_matrix, 50 * theta);
                }
            }
            if (Math.abs(_this._config.ZoomLevel - zoomLevel_old) >= 0.01) {
                view_matrix[14] = view_matrix[14] + (zoomLevel_old * -1) + _this._config.ZoomLevel;
                zoomLevel_old = _this._config.ZoomLevel;
            }
            //mat4.identity(mov_matrix);
            //mat4.translate(mov_matrix, mov_matrix, [0,0,-2]); // offset the object from the camera
            //mat4.rotate(mov_matrix, mov_matrix, App.DegToRad(angle), [0, 1, 0]);
            //mat4.translate(mov_matrix, mov_matrix, [5.0,0,0]); // x offset for rotation
            ctx.uniformMatrix4fv(_this._shader.Pmatrix, false, proj_matrix);
            ctx.uniformMatrix4fv(_this._shader.Vmatrix, false, view_matrix);
            ctx.uniformMatrix4fv(_this._shader.Mmatrix, false, mov_matrix);
            ctx.drawElements(_this._config.DrawMode, _this._indices.length, ctx.UNSIGNED_SHORT, 0);
            window.requestAnimationFrame(execAnimation);
        };
        execAnimation();
    };
    App.prototype.Draw = function (shape) {
        if (shape === void 0) { shape = this._config.Shape; }
        var ctx = this._ctx;
        var buffers = this.SetShape(shape);
        this._shader = App.ShaderProgram(this._ctx, buffers);
        ctx.bindBuffer(ctx.ARRAY_BUFFER, buffers.Vertex);
        var position = ctx.getAttribLocation(this._shader.ShaderProgram, "position");
        ctx.vertexAttribPointer(position, 3, ctx.FLOAT, false, 0, 0);
        ctx.enableVertexAttribArray(position);
        ctx.bindBuffer(ctx.ARRAY_BUFFER, null);
        ctx.bindBuffer(ctx.ARRAY_BUFFER, buffers.Color);
        var color = ctx.getAttribLocation(this._shader.ShaderProgram, "color");
        ctx.vertexAttribPointer(color, 4, ctx.FLOAT, false, 0, 0);
        ctx.enableVertexAttribArray(color);
        ctx.bindBuffer(ctx.ARRAY_BUFFER, null);
        var proj_matrix = new Float32Array(Matrix.GetProjection(40, this._canvas.width / this._canvas.height, 1, 100));
        var view_matrix = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        var mov_matrix = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        mat4.translate(mov_matrix, mov_matrix, new Float32Array([0, 0, 0])); // offset the object from the camera
        //mat4.rotate(mov_matrix, mov_matrix, App.DegToRad(45), new Float32Array([1, 0, 0]));
        //mat4.rotate(mov_matrix, mov_matrix, App.DegToRad(45), new Float32Array([0, 1, 0]));
        this._animate(proj_matrix, view_matrix, mov_matrix);
    };
    App.prototype.SetShape = function (shape) {
        var ctx = this._ctx;
        var geometry = new Cube3D();
        this._vertices = geometry.Vertices;
        this._indices = geometry.Indices;
        // dividing the number of indices by 3 will give us the total number of triangles drawn
        // on the mesh. Dividing the number of vertices by the number of triangles will give us the
        // number of faces on the mesh.
        this._triangleLength = this._indices.length / 3;
        this._vertexLength = this._vertices.length / 3;
        this._faceLength = this._vertices.length / this._triangleLength;
        this._facePointLength = this._vertexLength / this._faceLength;
        this._colors = this._generateColors(this._vertices, this._indices);
        var vertex_buffer = ctx.createBuffer();
        ctx.bindBuffer(ctx.ARRAY_BUFFER, vertex_buffer);
        ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array(this._vertices), ctx.STATIC_DRAW);
        vertex_buffer.itemSize = 3;
        vertex_buffer.length = this._vertices.length / 3;
        ctx.bindBuffer(ctx.ARRAY_BUFFER, null);
        var color_buffer = ctx.createBuffer();
        ctx.bindBuffer(ctx.ARRAY_BUFFER, color_buffer);
        ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array(this._colors), ctx.STATIC_DRAW);
        color_buffer.itemSize = 4;
        color_buffer.length = this._colors.length / 4;
        ctx.bindBuffer(ctx.ARRAY_BUFFER, null);
        var index_buffer = ctx.createBuffer();
        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, index_buffer);
        ctx.bufferData(ctx.ELEMENT_ARRAY_BUFFER, new Uint16Array(this._indices), ctx.STATIC_DRAW);
        index_buffer.itemSize = 3;
        index_buffer.length = this._indices.length / 3;
        ctx.bindBuffer(ctx.ARRAY_BUFFER, null);
        return {
            Vertex: vertex_buffer,
            Color: color_buffer,
            Index: index_buffer
        };
    };
    App.DegToRad = function (degrees) {
        return degrees * Math.PI / 180;
    };
    App.VertShader = function (context) {
        var vertCode = "\n\t\t\tattribute vec3 position;\n\t\t\t\n\t\t\tuniform mat4 Pmatrix;\n\t\t\tuniform mat4 Vmatrix;\n\t\t\tuniform mat4 Mmatrix;\n\n\t\t\tattribute vec4 color;\n\t\t\tvarying lowp vec4 vColor;\n\n\t\t\tvarying vec3 vLightWeighting;\n\t\t\t\n\t\t\tuniform vec3 uAmbientColor;\n\t\t\tuniform vec3 uPointLightingLocation;\n\t\t\tuniform vec3 uPointLightingColor;\n\n\t\t\tvoid main(void) {\n\t\t\t\tvec4 mvPosition = Mmatrix * vec4(position, 1.);\n\t\t\t\tgl_Position = Pmatrix*Vmatrix*mvPosition;\n\t\t\t\tgl_PointSize = 4.0;\n\t\t\t\tvColor = color;\n\n\t\t\t\t//vec3 lightDirection = normalize(uPointLightingLocation - mvPosition.xyz);\n\t\t\t\t//vec3 transformedNormal = vec3(Vmatrix) * position;\n\t\t\t\t//float directionalLightWeighting = max(dot(transformedNormal, lightDirection), 0.0);\n\t\t\t\t//vLightWeighting = uAmbientColor + uPointLightingColor * directionalLightWeighting;\n\t\t\t}";
        var vertShader = context.createShader(context.VERTEX_SHADER);
        context.shaderSource(vertShader, vertCode);
        context.compileShader(vertShader);
        return vertShader;
    };
    App.FragShader = function (context) {
        var fragCode = "\n\t\t\tprecision mediump float;\n\t\t\tvarying lowp vec4 vColor;\n\t\t\tvarying vec3 vLightWeighting;\n\t\t\tvoid main(void) {\n\t\t\t\tgl_FragColor = vColor;//vec4(vColor.rgb * vLightWeighting, 1.0);\n\t\t\t}";
        var fragShader = context.createShader(context.FRAGMENT_SHADER);
        context.shaderSource(fragShader, fragCode);
        context.compileShader(fragShader);
        return fragShader;
    };
    App.ShaderProgram = function (ctx, buffers) {
        var vertShader = App.VertShader(ctx);
        var fragShader = App.FragShader(ctx);
        var shaderProgram = ctx.createProgram();
        ctx.attachShader(shaderProgram, vertShader);
        ctx.attachShader(shaderProgram, fragShader);
        ctx.linkProgram(shaderProgram);
        var Pmatrix = ctx.getUniformLocation(shaderProgram, "Pmatrix");
        var Vmatrix = ctx.getUniformLocation(shaderProgram, "Vmatrix");
        var Mmatrix = ctx.getUniformLocation(shaderProgram, "Mmatrix");
        ctx.useProgram(shaderProgram);
        var ambientColor = ctx.getUniformLocation(shaderProgram, "uAmbientColor");
        var pointLightingLocation = ctx.getUniformLocation(shaderProgram, "uPointLightingLocation");
        var pointLightingColor = ctx.getUniformLocation(shaderProgram, "uPointLightingColor");
        ctx.uniform3f(ambientColor, 0.2, 0.2, 0.2);
        ctx.uniform3f(pointLightingLocation, 0.0, 0.0, 0.0);
        ctx.uniform3f(pointLightingColor, 1, 1, 1);
        return {
            Pmatrix: Pmatrix,
            Vmatrix: Vmatrix,
            Mmatrix: Mmatrix,
            ShaderProgram: shaderProgram,
            Buffers: buffers
        };
    };
    return App;
})();
var Matrix = (function () {
    function Matrix() {
    }
    // some of these are borrowed from https://github.com/toji/gl-matrix
    Matrix.GetProjection = function (angle, a, zMin, zMax) {
        var ang = Math.tan((angle * .5) * Math.PI / 180);
        return [
            0.5 / ang, 0, 0, 0,
            0, 0.5 * a / ang, 0, 0,
            0, 0, -(zMax + zMin) / (zMax - zMin), -1,
            0, 0, (-2 * zMax * zMin) / (zMax - zMin), 0
        ];
    };
    return Matrix;
})();
var Cube3D = (function () {
    function Cube3D() {
        this.Vertices = [
            // Front face
            -1.0, -1.0, 1.0,
            1.0, -1.0, 1.0,
            1.0, 1.0, 1.0,
            -1.0, 1.0, 1.0,
            // Back face
            -1.0, -1.0, -1.0,
            -1.0, 1.0, -1.0,
            1.0, 1.0, -1.0,
            1.0, -1.0, -1.0,
            // Top face
            -1.0, 1.0, -1.0,
            -1.0, 1.0, 1.0,
            1.0, 1.0, 1.0,
            1.0, 1.0, -1.0,
            // Bottom face
            -1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, -1.0, 1.0,
            -1.0, -1.0, 1.0,
            // Right face
            1.0, -1.0, -1.0,
            1.0, 1.0, -1.0,
            1.0, 1.0, 1.0,
            1.0, -1.0, 1.0,
            // Left face
            -1.0, -1.0, -1.0,
            -1.0, -1.0, 1.0,
            -1.0, 1.0, 1.0,
            -1.0, 1.0, -1.0
        ];
        this.Indices = [
            0, 1, 2, 0, 2, 3,
            4, 5, 6, 4, 6, 7,
            8, 9, 10, 8, 10, 11,
            12, 13, 14, 12, 14, 15,
            16, 17, 18, 16, 18, 19,
            20, 21, 22, 20, 22, 23 // left
        ];
    }
    return Cube3D;
})();
(function () {
    var app = new App(document.getElementById('canvas'));
    app.Draw();
})();
//# sourceMappingURL=index.js.map