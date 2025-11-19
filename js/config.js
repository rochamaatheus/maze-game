export const CONFIG = {
    CELL_SIZE: 5,
    WALL_HEIGHT: 5,
    PLAYER_HEIGHT: 2.0,
    PLAYER_RADIUS: 1.0,
    COLORS: {
        WALL: 0x333333,
        FLOOR: 0x080808,
        EXIT: 0x00ff00,
        ITEM: 0x00aaff,
        FOG: 0x050505,
        BG: 0x020202,

        HAMMER_HANDLE: 0x8B4513,
        HAMMER_HEAD: 0x7f8c8d,

        ENEMY: 0xff0000,
        ENEMY_VISION: 0xff0000
    },
    STAMINA: {
        MAX: 100,
        DRAIN_RATE: 40,
        REGEN_IDLE: 25,
        REGEN_WALK: 8
    },
    PHYSICS: {
        ACCELERATION: 600.0,
        FRICTION: 10.0,
        BASE_SPEED: 10.0,
        SPRINT_MULTIPLIER: 2,
        
        FOV_WALK: 75,
        FOV_RUN: 90
    },
    HAMMER: {
        COOLDOWN: 40,
        REACH: 4.5
    },
    ENEMY: {
        baseSpeed: 9.0,
        chaseSpeedMax: 13.0,
        viewDistance: 15.0,
        fov: Math.PI / 3,
        spawnRadiusMin: 30,
        spawnRadiusMax: 50,
        lifeTime: 20.0
    }
};