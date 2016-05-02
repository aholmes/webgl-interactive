/// <reference path="typings/gl-matrix.d.ts" />

// Following http://www.tutorialspoint.com/webgl/webgl_modes_of_drawing.htm
interface IWebGLBuffer extends WebGLBuffer
{
	itemSize: number;
	length: number;
}

interface IBufferContainer
{
	[key: string]: IWebGLBuffer;
	Vertex: IWebGLBuffer;
	Color: IWebGLBuffer;
	Index: IWebGLBuffer;
}

interface IShaderProgram
{
	Pmatrix: WebGLUniformLocation;
	Vmatrix: WebGLUniformLocation;
	Mmatrix: WebGLUniformLocation;
	ShaderProgram: WebGLProgram;
	Buffers: IBufferContainer;
}

interface I3DGeometry
{
	Vertices: number[];
	Indices: number[];
}

enum Shape
{
	Cube,
	Sphere
}

class App
{
	private _canvas: HTMLCanvasElement;
	private _ctx: WebGLRenderingContext;
	private _vertices: number[];
	private _indices: number[];
	private _colors: number[];
	private _shader: IShaderProgram;
	
	private _vertexLength: number;
	private _triangleLength: number;
	private _faceLength: number;
	private _facePointLength: number;
	
	private _config:
	{
		DrawMode: number;
		Quality: number;
		ZoomLevel: number;
		
		Rotation:
		{
			[key: string]: number;
			X: number;
			Y: number;
			Z: number;
		};
		
		Shape: Shape;
	};
	
	private _definedColors =
	[
		[1.0,  1.0,  1.0,  1.0],    // Front face: white
		[1.0,  0.0,  0.0,  1.0],    // Back face: red
		[0.0,  1.0,  0.0,  1.0],    // Top face: green
		[0.0,  0.0,  1.0,  1.0],    // Bottom face: blue
		[1.0,  1.0,  0.0,  1.0],    // Right face: yellow
		[1.0,  0.0,  1.0,  1.0]     // Left face: purple
	];

	constructor(canvas: HTMLCanvasElement)
	{
		this._canvas = canvas;
		this._ctx = <WebGLRenderingContext>canvas.getContext('webgl');
		this._canvas.setAttribute('width', this._canvas.clientWidth.toString());
		this._canvas.setAttribute('height', this._canvas.clientHeight.toString());
		
		this._ctx.viewport(0,0,canvas.width,canvas.height);
		
		this._config = 
		{
			DrawMode: this._ctx.TRIANGLES,
			Quality: 3,
			ZoomLevel: -4.0,
			
			Rotation:
			{
				X: 0,
				Y: 0,
				Z: 0
			},
			
			Shape: Shape.Cube
		};
		
		this._pageX = canvas.width / 2;
		this._pageY = canvas.height / 2;
		(<any>document).captureEvents((<any>Event).MOUSEMOVE);
		this._events['mousedown'] = (e: MouseEvent) => this._mouseUpDownHandler(e);
		this._events['mouseup']   = (e: MouseEvent) => this._mouseUpDownHandler(e);
		this._events['mousemove'] = (e: MouseEvent) => this._mouseMoveHandler(e);
		this._canvas.addEventListener('mousedown', this._events['mousedown']);
		this._canvas.addEventListener('mouseup',   this._events['mouseup']);
		document.addEventListener('mousemove', this._events['mousemove']);
	}
	
	private _events: {[key: string]: (e: Event) => void} = {};
	
	private _pageX: number;
	private _pageY: number;
	private _mouseIsDown = false;
	private _mouseUpDownHandler(e: MouseEvent)
	{
		this._mouseIsDown = !this._mouseIsDown;
	}
	
	private _mouseMoveHandler(e: MouseEvent)
	{
		this._pageX = e.pageX;
		this._pageY = e.pageY;
	}
	
	private _generateColors(vertices: number[], indices: number[], solid = true)
	{
		let colors:number[] = [];
		
		var outerIterations = solid === true
			? this._faceLength
			: (this._faceLength * this._facePointLength);
		
		var innerIterations = solid === true
			? this._facePointLength
			: 1;
			
		for(let i = 0; i < outerIterations; i++)
		{
			var color = this._definedColors[(i + 1) % this._definedColors.length];
			// set the same color for each vertex so the face will be drawn as a solid color
			for(var j = 0; j < innerIterations; j++)
			{
				colors = colors.concat(color);	
			}
		}

		// returns one RGBA for each INDEX
		return colors;
	}
	
	private _animating = false;
	private _animate(proj_matrix: Float32Array, view_matrix: Float32Array, mov_matrix: Float32Array)
	{
		if (this._animating) return;
		this._animating = true;
		
		const ctx = this._ctx;
		const rotThetas = this._config.Rotation;
		
		let timeThen = 0;
		let zoomLevel_old = 0;
		
		let halfCanvasWidth  = this._canvas.width / 2;
		let halfCanvasHeight = this._canvas.height / 2;

		ctx.enable(ctx.DEPTH_TEST);
		ctx.depthFunc(ctx.LEQUAL);
		ctx.clearDepth(1.0);
		ctx.viewport(0.0, 0.0, this._canvas.width, this._canvas.height);
		ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);
		let angle = 0;
		const execAnimation = () =>
		{
			var timeNow = new Date().getTime();
			if (timeThen !== 0)
			{
				angle += 0.05 * (timeNow - timeThen); 
			}
			timeThen = timeNow;

			var x = (this._pageX - halfCanvasWidth) / halfCanvasWidth;
			var y = (this._pageY - halfCanvasHeight) / halfCanvasHeight;
			
			mat4.rotateX(mov_matrix, mov_matrix, y*0.05);
			mat4.rotateY(mov_matrix, mov_matrix, x*0.05);

			for(var axis in rotThetas)
			{
				var theta = rotThetas[axis];
				if (theta > 0.0 || theta < 0.0)
				{
					(<any>mat4)[`rotate${axis}`](mov_matrix, 50*theta);
				}
			}

			if (Math.abs(this._config.ZoomLevel - zoomLevel_old) >= 0.01)
			{
				view_matrix[14] = view_matrix[14] + (zoomLevel_old * -1) + this._config.ZoomLevel;
				zoomLevel_old = this._config.ZoomLevel;
			}

			//mat4.identity(mov_matrix);
			//mat4.translate(mov_matrix, mov_matrix, [0,0,-2]); // offset the object from the camera
			//mat4.rotate(mov_matrix, mov_matrix, App.DegToRad(angle), [0, 1, 0]);
			//mat4.translate(mov_matrix, mov_matrix, [5.0,0,0]); // x offset for rotation
			
			ctx.uniformMatrix4fv(this._shader.Pmatrix, false, proj_matrix);
			ctx.uniformMatrix4fv(this._shader.Vmatrix, false, view_matrix);
			ctx.uniformMatrix4fv(this._shader.Mmatrix, false, mov_matrix);
			
			ctx.drawElements(this._config.DrawMode, this._indices.length, ctx.UNSIGNED_SHORT, 0);
			
			window.requestAnimationFrame(execAnimation);
		}
		
		execAnimation();
	}

	public Draw(shape: Shape = this._config.Shape)
	{
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

		var proj_matrix = new Float32Array(Matrix.GetProjection(40, this._canvas.width/this._canvas.height, 1, 100));
		var view_matrix = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
		var mov_matrix = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);

		mat4.translate(mov_matrix, mov_matrix, new Float32Array([0,0,0])); // offset the object from the camera
		//mat4.rotate(mov_matrix, mov_matrix, App.DegToRad(45), new Float32Array([1, 0, 0]));
		//mat4.rotate(mov_matrix, mov_matrix, App.DegToRad(45), new Float32Array([0, 1, 0]));

		this._animate(proj_matrix, view_matrix, mov_matrix);
	}

	public SetShape(shape: Shape): IBufferContainer
	{
		var ctx = this._ctx;
		var geometry: I3DGeometry = new Cube3D();
		
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

		var vertex_buffer = <IWebGLBuffer>ctx.createBuffer();
		ctx.bindBuffer(ctx.ARRAY_BUFFER, vertex_buffer);
		ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array(this._vertices), ctx.STATIC_DRAW);
		vertex_buffer.itemSize = 3;
		vertex_buffer.length = this._vertices.length / 3;
		ctx.bindBuffer(ctx.ARRAY_BUFFER, null);
	  
		var color_buffer = <IWebGLBuffer>ctx.createBuffer();
		ctx.bindBuffer(ctx.ARRAY_BUFFER, color_buffer);
		ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array(this._colors), ctx.STATIC_DRAW);
		color_buffer.itemSize = 4;
		color_buffer.length = this._colors.length / 4;
		ctx.bindBuffer(ctx.ARRAY_BUFFER, null);
		
		var index_buffer = <IWebGLBuffer>ctx.createBuffer();
		ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, index_buffer);
		ctx.bufferData(ctx.ELEMENT_ARRAY_BUFFER, new Uint16Array(this._indices), ctx.STATIC_DRAW);
		index_buffer.itemSize = 3;
		index_buffer.length = this._indices.length / 3;
		ctx.bindBuffer(ctx.ARRAY_BUFFER, null);
		
		return {
			Vertex : vertex_buffer,
			Color  : color_buffer,
			Index  : index_buffer
		};
	}

	public static DegToRad(degrees:number)
	{
		return degrees * Math.PI / 180;
	}

	public static VertShader(context: WebGLRenderingContext)
	{
		var vertCode = `
			attribute vec3 position;
			
			uniform mat4 Pmatrix;
			uniform mat4 Vmatrix;
			uniform mat4 Mmatrix;

			attribute vec4 color;
			varying lowp vec4 vColor;

			varying vec3 vLightWeighting;
			
			uniform vec3 uAmbientColor;
			uniform vec3 uPointLightingLocation;
			uniform vec3 uPointLightingColor;

			void main(void) {
				vec4 mvPosition = Mmatrix * vec4(position, 1.);
				gl_Position = Pmatrix*Vmatrix*mvPosition;
				gl_PointSize = 4.0;
				vColor = color;

				//vec3 lightDirection = normalize(uPointLightingLocation - mvPosition.xyz);
				//vec3 transformedNormal = vec3(Vmatrix) * position;
				//float directionalLightWeighting = max(dot(transformedNormal, lightDirection), 0.0);
				//vLightWeighting = uAmbientColor + uPointLightingColor * directionalLightWeighting;
			}`;
		
		var vertShader = context.createShader(context.VERTEX_SHADER);
		context.shaderSource(vertShader, vertCode);
		context.compileShader(vertShader);
		
		return vertShader;
	}

	public static FragShader(context: WebGLRenderingContext)
	{
		var fragCode = `
			precision mediump float;
			varying lowp vec4 vColor;
			varying vec3 vLightWeighting;
			void main(void) {
				gl_FragColor = vColor;//vec4(vColor.rgb * vLightWeighting, 1.0);
			}`;
		
		var fragShader = context.createShader(context.FRAGMENT_SHADER);
		context.shaderSource(fragShader, fragCode);
		context.compileShader(fragShader);
    
		return fragShader;
	}

	public static ShaderProgram(ctx: WebGLRenderingContext, buffers: IBufferContainer): IShaderProgram
	{
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
		ctx.uniform3f(pointLightingLocation, 0.0,0.0,0.0);
		ctx.uniform3f(pointLightingColor, 1,1,1);
    
		return {
			Pmatrix: Pmatrix,
			Vmatrix: Vmatrix,
			Mmatrix: Mmatrix,
			ShaderProgram: shaderProgram,
			Buffers: buffers
		};
	}
}

class Matrix
{
	// some of these are borrowed from https://github.com/toji/gl-matrix
	public static GetProjection(angle: number, a: number, zMin: number, zMax: number)
	{
		var ang = Math.tan((angle*.5)*Math.PI/180);
		return [
			0.5/ang, 0 , 0, 0,
			0, 0.5*a/ang, 0, 0,
			0, 0, -(zMax+zMin)/(zMax-zMin), -1,
			0, 0, (-2*zMax*zMin)/(zMax-zMin), 0
		];
	}
}

class Cube3D implements I3DGeometry
{
	public Vertices =
	[
		// Front face
		-1.0, -1.0,  1.0,
		1.0, -1.0,  1.0,
		1.0,  1.0,  1.0,
		-1.0,  1.0,  1.0,
  
		// Back face
		-1.0, -1.0, -1.0,
		-1.0,  1.0, -1.0,
		1.0,  1.0, -1.0,
		1.0, -1.0, -1.0,
  
		// Top face
		-1.0,  1.0, -1.0,
		-1.0,  1.0,  1.0,
		1.0,  1.0,  1.0,
		1.0,  1.0, -1.0,
  
		// Bottom face
		-1.0, -1.0, -1.0,
		1.0, -1.0, -1.0,
		1.0, -1.0,  1.0,
		-1.0, -1.0,  1.0,
  
		// Right face
		1.0, -1.0, -1.0,
		1.0,  1.0, -1.0,
		1.0,  1.0,  1.0,
		1.0, -1.0,  1.0,
  
		// Left face
		-1.0, -1.0, -1.0,
		-1.0, -1.0,  1.0,
		-1.0,  1.0,  1.0,
		-1.0,  1.0, -1.0
	];
	
	public Indices =
	[
		0,  1,  2,      0,  2,  3,    // front
		4,  5,  6,      4,  6,  7,    // back
		8,  9,  10,     8,  10, 11,   // top
		12, 13, 14,     12, 14, 15,   // bottom
		16, 17, 18,     16, 18, 19,   // right
		20, 21, 22,     20, 22, 23    // left
	];
}

(() =>
{
	let app = new App(<HTMLCanvasElement>document.getElementById('canvas'));
	app.Draw();
})();
