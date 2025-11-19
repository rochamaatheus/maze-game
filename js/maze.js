import * as THREE from 'three';
import { CONFIG } from './config.js';

export class MazeManager {
    constructor(scene) {
        this.scene = scene;
        this.size = 21;
        this.data = []; 
        this.meshes = []; 
        this.walls = []; 
    }

    generate(size) {
        this.size = size;
        this.data = [];
        
        this.meshes.forEach(m => {
            this.scene.remove(m);
            if(m.geometry) m.geometry.dispose();
            if(m.material) m.material.dispose();
        });
        this.meshes = [];
        this.walls = [];

        for(let x=0; x<this.size; x++) {
            this.data[x] = [];
            for(let z=0; z<this.size; z++) {
                this.data[x][z] = 1; 
            }
        }

        let cells = [];
        let start = {x:1, z:1};
        this.data[1][1] = 0;
        cells.push(start);

        while(cells.length > 0) {
            let index = Math.random() > 0.3 ? cells.length - 1 : Math.floor(Math.random() * cells.length);
            let current = cells[index];
            
            let neighbors = [];
            let dirs = [{x:0, z:-2}, {x:0, z:2}, {x:-2, z:0}, {x:2, z:0}];
            
            dirs.forEach(d => {
                let nx = current.x + d.x;
                let nz = current.z + d.z;
                if(nx > 0 && nx < this.size-1 && nz > 0 && nz < this.size-1) {
                    if(this.data[nx][nz] === 1) neighbors.push({x:nx, z:nz});
                }
            });

            if(neighbors.length > 0) {
                let next = neighbors[Math.floor(Math.random() * neighbors.length)];
                this.data[(current.x + next.x)/2][(current.z + next.z)/2] = 0;
                this.data[next.x][next.z] = 0;
                cells.push(next);
            } else {
                cells.splice(index, 1);
            }
        }

        let far = this._findFarthest(1, 1);
        this.data[far.x][far.z] = 2;

        this._buildVisuals();
    }

    _findFarthest(startX, startZ) {
        let queue = [{x:startX, z:startZ, dist:0}];
        let visited = new Set();
        let max = {dist:-1, x:startX, z:startZ};
        while(queue.length) {
            let c = queue.shift();
            let key = `${c.x},${c.z}`;
            if(visited.has(key)) continue;
            visited.add(key);
            if(c.dist > max.dist) max = c;
            [{x:0,z:-1},{x:0,z:1},{x:-1,z:0},{x:1,z:0}].forEach(d => {
                let nx = c.x+d.x, nz = c.z+d.z;
                if(nx>=0 && nx<this.size && nz>=0 && nz<this.size && this.data[nx][nz]!==1) {
                    queue.push({x:nx, z:nz, dist:c.dist+1});
                }
            });
        }
        return {x:max.x, z:max.z};
    }

    _buildVisuals() {
        const wallGeo = new THREE.BoxGeometry(CONFIG.CELL_SIZE, CONFIG.WALL_HEIGHT, CONFIG.CELL_SIZE);
        const wallMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.WALL, roughness: 0.7 });
        
        for(let x=0; x<this.size; x++) {
            for(let z=0; z<this.size; z++) {
                let wx = x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE/2;
                let wz = z * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE/2;
                
                if(this.data[x][z] === 1) {
                    const wall = new THREE.Mesh(wallGeo, wallMat);
                    wall.position.set(wx, CONFIG.WALL_HEIGHT/2, wz);
                    wall.userData = { gridX: x, gridZ: z };
                    
                    this.scene.add(wall);
                    this.meshes.push(wall); 
                    this.walls.push(wall); 
                } 
                else if (this.data[x][z] === 2) {
                    const exitGeo = new THREE.BoxGeometry(CONFIG.CELL_SIZE*0.6, 1, CONFIG.CELL_SIZE*0.6);
                    const exitMat = new THREE.MeshBasicMaterial({ color: CONFIG.COLORS.EXIT });
                    const exit = new THREE.Mesh(exitGeo, exitMat);
                    exit.position.set(wx, 0.5, wz);
                    this.scene.add(exit);
                    this.meshes.push(exit);
                    const light = new THREE.PointLight(CONFIG.COLORS.EXIT, 5, 20);
                    light.position.set(wx, 2, wz);
                    this.scene.add(light);
                    this.meshes.push(light);
                }
            }
        }

        const floorSize = this.size * CONFIG.CELL_SIZE;
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(floorSize, floorSize),
            new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.FLOOR, roughness: 1 })
        );
        floor.rotation.x = -Math.PI/2;
        
        // CORREÇÃO CRÍTICA: Chão em -0.05 para não piscar com a base da parede
        floor.position.set(floorSize/2, -0.05, floorSize/2); 
        
        this.scene.add(floor);
        this.meshes.push(floor);
    }

    removeWall(wallMesh) {
        const { gridX, gridZ } = wallMesh.userData;
        if(gridX !== undefined && gridZ !== undefined) {
            this.data[gridX][gridZ] = 0; 
        }

        const idx = this.walls.indexOf(wallMesh);
        if(idx > -1) this.walls.splice(idx, 1);

        this.scene.remove(wallMesh);
    }

    checkCollision(x, z, radius) {
        const padding = radius * 0.8;
        const points = [
            {x: x+padding, z: z+padding}, {x: x-padding, z: z+padding},
            {x: x+padding, z: z-padding}, {x: x-padding, z: z-padding}
        ];
        for(let p of points) {
            let gx = Math.floor(p.x / CONFIG.CELL_SIZE);
            let gz = Math.floor(p.z / CONFIG.CELL_SIZE);
            if(gx < 0 || gx >= this.size || gz < 0 || gz >= this.size) return true;
            if(this.data[gx][gz] === 1) return true;
        }
        return false;
    }
}