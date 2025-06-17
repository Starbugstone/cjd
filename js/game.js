// Performance optimized game engine
class OptimizedGame {
    constructor() {
        // Configuration
        this.POWER_COOLDOWN_MS = 20000; // 20 seconds cooldown
        this.POWER_COST = 5; // Points deducted when using power
        this.POWER_MIN_SCORE = 10; // Minimum score required to use power
        
        // Cache DOM elements
        this.elements = {
            iris: document.querySelector('.iris'),
            eyeContainer: document.querySelector('.eye-container'),
            laser: document.getElementById('laser'),
            scoreElement: document.getElementById('score'),
            fpsElement: document.getElementById('fps'),
            cloudsContainer: document.getElementById('clouds-container'),
            powerImage: document.getElementById('power-image'),
            screenFlash: document.getElementById('screen-flash')
        };

        // Game state
        this.mouseX = 0;
        this.mouseY = 0;
        this.score = 0;
        this.isLive = true;
        this.isLaserActive = false;
        
        // Power-up system
        this.powerCooldown = false;
        this.powerReady = false;
        this.lastPowerUse = 0;
        
        // Performance tracking
        this.lastTime = 0;
        this.frameCount = 0;
        this.fps = 0;
        
        // Object pools
        this.airplanePool = [];
        this.robotPool = [];
        this.explosionPool = [];
        this.destructionExplosionPool = [];
        
        // Active objects tracking
        this.activeAirplanes = new Set();
        this.activeRobots = new Set();
        this.activeClouds = new Set();
        
        // Cloud management
        this.cloudPositions = new Map();
        this.cloudSpeeds = new Map();
        
        // Initialize
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeClouds();
        this.initializeObjectPools();
        this.startGameLoop();
        this.scheduleSpawning();
        this.showInitialPowerHint();
    }

    showInitialPowerHint() {
        // Show the power animation at start to hint at the feature
        setTimeout(() => {
            this.elements.scoreElement.classList.add('power-charging');
            setTimeout(() => {
                this.elements.scoreElement.classList.remove('power-charging');
                this.updatePowerState();
            }, this.POWER_COOLDOWN_MS);
        }, 1000);
    }

    setupEventListeners() {
        // Use cached references and passive listeners where possible
        document.addEventListener('mousemove', this.handleMouseMove.bind(this), { passive: true });
        document.addEventListener('click', this.handleClick.bind(this));
        
        // Power-up click listener
        this.elements.scoreElement.addEventListener('click', this.handlePowerClick.bind(this));
        
        // Handle window resize efficiently
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.handleResize(), 100);
        }, { passive: true });
    }

    handleMouseMove(e) {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        this.updateEyePosition();
    }

    handleClick(e) {
        this.fireLaser(e.clientX, e.clientY);
    }

    handleResize() {
        // Update any size-dependent calculations
        this.updateCloudBoundaries();
    }

    updateEyePosition() {
        const eyeRect = this.elements.eyeContainer.getBoundingClientRect();
        const eyeCenterX = eyeRect.left + eyeRect.width / 2;
        const eyeCenterY = eyeRect.top + eyeRect.height / 2;

        const deltaX = this.mouseX - eyeCenterX;
        const deltaY = this.mouseY - eyeCenterY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        const maxDistance = 20;
        const limitedDistance = Math.min(distance, maxDistance);
        const angle = Math.atan2(deltaY, deltaX);

        const irisX = Math.cos(angle) * limitedDistance;
        const irisY = Math.sin(angle) * limitedDistance;

        // Use transform instead of separate properties for better performance
        this.elements.iris.style.transform = `translate(calc(-50% + ${irisX}px), calc(-50% + ${irisY}px))`;
    }

    // Object pooling implementation
    initializeObjectPools() {
        // Pre-create objects to avoid garbage collection
        for (let i = 0; i < 10; i++) {
            this.airplanePool.push(this.createAirplane());
            this.robotPool.push(this.createRobot());
            this.explosionPool.push(this.createExplosion());
            this.destructionExplosionPool.push(this.createDestructionExplosion());
        }
    }

    getFromPool(pool) {
        return pool.find(obj => !obj.active) || null;
    }

    returnToPool(obj) {
        obj.active = false;
        obj.element.style.display = 'none';
        obj.element.style.transform = '';
        obj.element.className = obj.element.className.replace(/\s*(crashed|destroyed|active)\s*/g, ' ').trim();
        
        // Reset position to avoid memory leaks
        obj.x = 0;
        obj.y = 0;
    }

    createAirplane() {
        const airplane = document.createElement('div');
        airplane.className = 'airplane moving-object';
        airplane.style.display = 'none';
        this.elements.cloudsContainer.appendChild(airplane);
        
        return {
            element: airplane,
            active: false,
            x: 0,
            y: 0,
            speed: 0,
            startTime: 0
        };
    }

    createRobot() {
        const robot = document.createElement('div');
        robot.className = 'robot moving-object';
        robot.style.display = 'none';
        this.elements.cloudsContainer.appendChild(robot);
        
        return {
            element: robot,
            active: false,
            x: 0,
            y: 0,
            speed: 0,
            startTime: 0,
            waveOffset: Math.random() * Math.PI * 2
        };
    }

    createExplosion() {
        const explosion = document.createElement('div');
        explosion.className = 'explosion';
        explosion.style.display = 'none';
        document.body.appendChild(explosion);
        
        return {
            element: explosion,
            active: false
        };
    }

    createDestructionExplosion() {
        const explosion = document.createElement('div');
        explosion.className = 'destruction-explosion';
        explosion.style.display = 'none';
        document.body.appendChild(explosion);
        
        return {
            element: explosion,
            active: false
        };
    }

    // Optimized cloud management
    initializeClouds() {
        const clouds = document.querySelectorAll('.cloud');
        clouds.forEach((cloud, index) => {
            this.activeClouds.add(cloud);
            this.cloudPositions.set(cloud, { x: -200, y: 0 });
            this.cloudSpeeds.set(cloud, 0.8 + Math.random() * 1.2); // Smoother speed between 0.8-2.0
            
            // Set initial position
            cloud.style.left = '-200px';
        });
    }

    updateCloudBoundaries() {
        // Update cloud movement boundaries when window resizes
        this.windowWidth = window.innerWidth;
    }

    // Main game loop using requestAnimationFrame
    startGameLoop() {
        this.windowWidth = window.innerWidth;
        this.gameLoop();
    }

    gameLoop(currentTime = 0) {
        // Calculate FPS
        if (currentTime - this.lastTime >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
            this.elements.fpsElement.textContent = `FPS: ${this.fps}`;
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
        this.frameCount++;

        // Update game objects
        this.updateClouds();
        this.updateAirplanes(currentTime);
        this.updateRobots(currentTime);

        // Update power state periodically
        if (this.frameCount % 60 === 0) { // Every second at 60fps
            this.updatePowerState();
        }

        // Cleanup inactive objects periodically to prevent memory leaks
        if (this.frameCount % 300 === 0) { // Every 5 seconds at 60fps
            this.cleanupInactiveObjects();
        }

        // Continue the game loop
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    updateClouds() {
        for (const cloud of this.activeClouds) {
            if (cloud.classList.contains('vaporized')) continue;
            
            const position = this.cloudPositions.get(cloud);
            const speed = this.cloudSpeeds.get(cloud);
            
            position.x += speed;
            
            if (position.x > this.windowWidth + 200) {
                position.x = -200;
            }
            
            cloud.style.left = position.x + 'px';
        }
    }

    updateAirplanes(currentTime) {
        const airplanesArray = Array.from(this.activeAirplanes);
        for (let i = airplanesArray.length - 1; i >= 0; i--) {
            const airplane = airplanesArray[i];
            if (!airplane.active) {
                this.activeAirplanes.delete(airplane);
                continue;
            }
            
            const elapsed = (currentTime - airplane.startTime) / 1000;
            airplane.x = elapsed * airplane.speed;
            
            if (airplane.x > this.windowWidth + 100) {
                this.activeAirplanes.delete(airplane);
                this.returnToPool(airplane);
                continue;
            }
            
            airplane.element.style.transform = `translateX(${airplane.x}px)`;
        }
    }

    updateRobots(currentTime) {
        const robotsArray = Array.from(this.activeRobots);
        for (let i = robotsArray.length - 1; i >= 0; i--) {
            const robot = robotsArray[i];
            if (!robot.active) {
                this.activeRobots.delete(robot);
                continue;
            }
            
            const elapsed = (currentTime - robot.startTime) / 1000;
            robot.x = elapsed * robot.speed;
            
            if (robot.x > this.windowWidth + 100) {
                this.activeRobots.delete(robot);
                this.returnToPool(robot);
                continue;
            }
            
            // Wave motion - faster and more pronounced
            const waveY = Math.sin(elapsed * 4 + robot.waveOffset) * 40;
            robot.element.style.transform = `translate(${robot.x}px, ${waveY}px)`;
        }
    }

    // Optimized spawning system
    scheduleSpawning() {
        // Airplane spawning - more frequent and challenging
        const spawnAirplanes = () => {
            const numAirplanes = Math.floor(Math.random() * 4) + 1; // 1-4 airplanes
            
            for (let i = 0; i < numAirplanes; i++) {
                setTimeout(() => {
                    this.spawnAirplane();
                }, i * 300); // Spawn faster (every 300ms instead of 500ms)
            }
            
            setTimeout(spawnAirplanes, 1500 + Math.random() * 3000); // More frequent spawning
        };

        // Robot spawning - more frequent for higher difficulty
        const spawnRobots = () => {
            this.spawnRobot();
            setTimeout(spawnRobots, 8000 + Math.random() * 4000); // Spawn every 8-12 seconds instead of 10-15
        };

        // Start spawning - begin action sooner
        setTimeout(spawnAirplanes, 500); // Start airplanes after 0.5 seconds
        setTimeout(spawnRobots, 6000); // Start robots after 6 seconds instead of 10
    }

    spawnAirplane() {
        const airplane = this.getFromPool(this.airplanePool);
        if (!airplane) return;

        airplane.active = true;
        airplane.x = -80;
        airplane.y = Math.random() * 80 + 10; // 10-90%
        airplane.speed = 180 + Math.random() * 120; // Smoother: 180-300 pixels per second
        airplane.startTime = performance.now();

        airplane.element.style.display = 'block';
        airplane.element.style.top = airplane.y + '%';
        airplane.element.style.left = '-80px';
        airplane.element.style.transform = 'translateX(0)';

        this.activeAirplanes.add(airplane);
    }

    spawnRobot() {
        const robot = this.getFromPool(this.robotPool);
        if (!robot) return;

        robot.active = true;
        robot.x = -60;
        robot.y = Math.random() * 50 + 30; // 30-80%
        robot.speed = 120 + Math.random() * 80; // Balanced: 120-200 pixels per second
        robot.startTime = performance.now();
        robot.waveOffset = Math.random() * Math.PI * 2;

        robot.element.style.display = 'block';
        robot.element.style.top = robot.y + '%';
        robot.element.style.left = '-60px';
        robot.element.style.transform = 'translate(0, 0)';

        this.activeRobots.add(robot);
    }

    // Optimized laser and collision system
    fireLaser(targetX, targetY) {
        // Prevent rapid firing to improve responsiveness
        if (this.isLaserActive) return;
        this.isLaserActive = true;

        const pupilRect = document.querySelector('.pupil').getBoundingClientRect();
        const pupilCenterX = pupilRect.left + pupilRect.width / 2;
        const pupilCenterY = pupilRect.top + pupilRect.height / 2;

        const deltaX = targetX - pupilCenterX;
        const deltaY = targetY - pupilCenterY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

        // Check collisions efficiently
        this.checkCollisions(pupilCenterX, pupilCenterY, targetX, targetY);

        // Render laser
        this.elements.laser.style.left = pupilCenterX + 'px';
        this.elements.laser.style.top = pupilCenterY + 'px';
        this.elements.laser.style.height = distance + 'px';
        this.elements.laser.style.transform = `rotate(${angle - 90}deg)`;
        this.elements.laser.classList.add('active');

        // Create explosion at target
        this.createExplosionAt(targetX, targetY);

        // Remove laser after animation and allow new firing
        setTimeout(() => {
            this.elements.laser.classList.remove('active');
            this.isLaserActive = false;
        }, 150); // Reduced from 300ms for better responsiveness
    }

    checkCollisions(startX, startY, endX, endY) {
        // Check cloud collisions
        const cloudsArray = Array.from(this.activeClouds);
        for (const cloud of cloudsArray) {
            if (cloud.classList.contains('vaporized')) continue;
            
            const rect = cloud.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            if (this.isPointNearLine(startX, startY, endX, endY, centerX, centerY, 50)) {
                this.vaporizeCloud(cloud);
                this.createDestructionExplosionAt(centerX, centerY);
                break; // Only hit one target per shot for better performance
            }
        }

        // Check airplane collisions
        const airplanesArray = Array.from(this.activeAirplanes);
        for (const airplane of airplanesArray) {
            if (!airplane.active) continue;
            
            const rect = airplane.element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            if (this.isPointNearLine(startX, startY, endX, endY, centerX, centerY, 40)) {
                this.crashAirplane(airplane);
                this.createDestructionExplosionAt(centerX, centerY);
                break; // Only hit one target per shot for better performance
            }
        }

        // Check robot collisions
        const robotsArray = Array.from(this.activeRobots);
        for (const robot of robotsArray) {
            if (!robot.active) continue;
            
            const rect = robot.element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            if (this.isPointNearLine(startX, startY, endX, endY, centerX, centerY, 35)) {
                this.destroyRobot(robot);
                this.createDestructionExplosionAt(centerX, centerY);
                break; // Only hit one target per shot for better performance
            }
        }
    }

    isPointNearLine(x1, y1, x2, y2, px, py, threshold) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx, yy;
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy) < threshold;
    }

    vaporizeCloud(cloud) {
        cloud.classList.add('vaporized');
        this.updateScore(-1);
        
        setTimeout(() => {
            cloud.classList.remove('vaporized');
            this.cloudPositions.set(cloud, { x: -200, y: 0 });
        }, 3000);
    }

    crashAirplane(airplane) {
        airplane.element.classList.add('crashed');
        this.activeAirplanes.delete(airplane);
        this.updateScore(1);
        
        setTimeout(() => {
            this.returnToPool(airplane);
        }, 1000);
    }

    destroyRobot(robot) {
        robot.element.classList.add('destroyed');
        this.activeRobots.delete(robot);
        this.updateScore(3);
        
        setTimeout(() => {
            this.returnToPool(robot);
        }, 1000);
    }

    createExplosionAt(x, y) {
        const explosion = this.getFromPool(this.explosionPool);
        if (!explosion) return;

        explosion.active = true;
        explosion.element.style.display = 'block';
        explosion.element.style.left = x + 'px';
        explosion.element.style.top = y + 'px';
        explosion.element.classList.add('active');

        setTimeout(() => {
            explosion.element.classList.remove('active');
            this.returnToPool(explosion);
        }, 600);
    }

    createDestructionExplosionAt(x, y) {
        const explosion = this.getFromPool(this.destructionExplosionPool);
        if (!explosion) return;

        explosion.active = true;
        explosion.element.style.display = 'block';
        explosion.element.style.left = x + 'px';
        explosion.element.style.top = y + 'px';
        explosion.element.classList.add('active');

        setTimeout(() => {
            explosion.element.classList.remove('active');
            this.returnToPool(explosion);
        }, 800);
    }

    updateScore(points) {
        this.score += points;
        this.elements.scoreElement.textContent = `Score: ${this.score}`;
        this.updatePowerState();
    }

    updatePowerState() {
        const currentTime = performance.now();
        const timeSincePowerUse = currentTime - this.lastPowerUse;
        
        // Remove all power classes first
        this.elements.scoreElement.classList.remove('power-ready', 'power-cooldown', 'power-charging');
        
        if (this.powerCooldown && timeSincePowerUse < this.POWER_COOLDOWN_MS) {
            // Still in cooldown
            this.elements.scoreElement.classList.add('power-charging');
        } else if (this.powerCooldown && timeSincePowerUse >= this.POWER_COOLDOWN_MS) {
            // Cooldown finished
            this.powerCooldown = false;
        }
        
        // Check if power is ready (score >= minimum and not in cooldown)
        if (this.score >= this.POWER_MIN_SCORE && !this.powerCooldown) {
            this.powerReady = true;
            this.elements.scoreElement.classList.add('power-ready');
        } else {
            this.powerReady = false;
        }
    }

    handlePowerClick(e) {
        e.stopPropagation(); // Prevent laser firing
        
        if (!this.powerReady || this.powerCooldown || this.score < this.POWER_MIN_SCORE) {
            return;
        }
        
        this.activatePower();
    }

    activatePower() {
        // Deduct points
        this.score -= this.POWER_COST;
        this.elements.scoreElement.textContent = `Score: ${this.score}`;
        
        // Start cooldown
        this.powerCooldown = true;
        this.powerReady = false;
        this.lastPowerUse = performance.now();
        
        // Update visual state
        this.updatePowerState();
        
        // Execute power sequence
        this.executePowerSequence();
    }

    executePowerSequence() {
        // 1. Drop the power image
        this.elements.powerImage.classList.add('active');
        
        // 2. Flash the screen
        setTimeout(() => {
            this.elements.screenFlash.classList.add('active');
        }, 1000);
        
        // 3. Destroy all enemies and award points
        setTimeout(() => {
            this.destroyAllEnemies();
        }, 1500);
        
        // 4. Clean up after animation
        setTimeout(() => {
            this.elements.powerImage.classList.remove('active');
            this.elements.screenFlash.classList.remove('active');
        }, 3000);
    }

    destroyAllEnemies() {
        let destroyedCount = 0;
        
        // Destroy all active airplanes
        this.activeAirplanes.forEach(airplane => {
            if (airplane.active) {
                airplane.element.classList.add('crashed');
                this.activeAirplanes.delete(airplane);
                destroyedCount++;
                
                // Create explosion at airplane position
                const rect = airplane.element.getBoundingClientRect();
                this.createDestructionExplosionAt(rect.left + rect.width/2, rect.top + rect.height/2);
                
                setTimeout(() => {
                    this.returnToPool(airplane);
                }, 1000);
            }
        });
        
        // Destroy all active robots
        this.activeRobots.forEach(robot => {
            if (robot.active) {
                robot.element.classList.add('destroyed');
                this.activeRobots.delete(robot);
                destroyedCount += 3; // Robots are worth 3 points each
                
                // Create explosion at robot position
                const rect = robot.element.getBoundingClientRect();
                this.createDestructionExplosionAt(rect.left + rect.width/2, rect.top + rect.height/2);
                
                setTimeout(() => {
                    this.returnToPool(robot);
                }, 1000);
            }
        });
        
        // Award points for destroyed enemies
        if (destroyedCount > 0) {
            this.score += destroyedCount;
            this.elements.scoreElement.textContent = `Score: ${this.score}`;
            this.updatePowerState();
        }
    }

    cleanupInactiveObjects() {
        // Clean up inactive airplanes
        this.activeAirplanes.forEach(airplane => {
            if (!airplane.active) {
                this.activeAirplanes.delete(airplane);
            }
        });

        // Clean up inactive robots
        this.activeRobots.forEach(robot => {
            if (!robot.active) {
                this.activeRobots.delete(robot);
            }
        });

        // Reset object pools if they get too large
        if (this.airplanePool.length > 20) {
            this.airplanePool = this.airplanePool.slice(0, 10);
        }
        if (this.robotPool.length > 20) {
            this.robotPool = this.robotPool.slice(0, 10);
        }
        if (this.explosionPool.length > 30) {
            this.explosionPool = this.explosionPool.slice(0, 15);
        }
        if (this.destructionExplosionPool.length > 30) {
            this.destructionExplosionPool = this.destructionExplosionPool.slice(0, 15);
        }
    }
}

// Initialize the optimized game
document.addEventListener('DOMContentLoaded', () => {
    new OptimizedGame();
}); 