import fs   from 'fs';
import path from 'path';

export class ProjectDetector {
  detect(projectPath) {
    if (!fs.existsSync(projectPath)) return this._empty();
    const files = this._ls(projectPath);

    // Django
    if (files.includes('manage.py')) {
      return {
        type: 'Django', detected: true,
        command: 'python manage.py runserver',
        installCmd: 'pip install -r requirements.txt',
        port: 8000, ide: 'VS Code',
        steps: [
          { label: 'Install deps',   cmd: 'pip install -r requirements.txt', wait: true  },
          { label: 'Run migrations', cmd: 'python manage.py migrate',        wait: true  },
          { label: 'Start server',   cmd: 'python manage.py runserver',      wait: false },
        ],
      };
    }

    // FastAPI / Flask
    if (files.includes('requirements.txt')) {
      const reqs = this._read(projectPath, 'requirements.txt').toLowerCase();
      if (reqs.includes('fastapi')) {
        const entry = files.includes('main.py') ? 'main' : 'app';
        return {
          type: 'FastAPI', detected: true,
          command: `uvicorn ${entry}:app --reload`,
          installCmd: 'pip install -r requirements.txt',
          port: 8001, ide: 'VS Code',
          steps: [
            { label: 'Install deps', cmd: 'pip install -r requirements.txt',  wait: true  },
            { label: 'Start server', cmd: `uvicorn ${entry}:app --reload`,    wait: false },
          ],
        };
      }
      if (reqs.includes('flask')) {
        return {
          type: 'Flask', detected: true,
          command: 'flask run',
          installCmd: 'pip install -r requirements.txt',
          port: 5000, ide: 'VS Code',
          steps: [
            { label: 'Install deps', cmd: 'pip install -r requirements.txt', wait: true  },
            { label: 'Start server', cmd: 'flask run',                       wait: false },
          ],
        };
      }
    }

    // package.json based
    if (files.includes('package.json')) {
      const pkg  = this._readJson(projectPath, 'package.json');
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const mgr  = files.includes('yarn.lock') ? 'yarn' : files.includes('pnpm-lock.yaml') ? 'pnpm' : 'npm';
      const install = `${mgr} install`;

      if (deps['next'])            return this._node('Next.js',  `${mgr} run dev`, install, pkg, 3000, steps => [...steps]);
      if (deps['@angular/core'])   return this._node('Angular',  'ng serve',       install, pkg, 4200);
      if (deps['react'])           return this._node('React',    pkg.scripts?.dev ? `${mgr} run dev` : `${mgr} start`, install, pkg, 3000);
      if (deps['vue'] || deps['@vue/core']) return this._node('Vue', `${mgr} run dev`, install, pkg, 5173);
      if (deps['nuxt'])            return this._node('Nuxt',     `${mgr} run dev`, install, pkg, 3000);

      const startCmd = pkg.scripts?.dev ? `${mgr} run dev` : pkg.scripts?.start ? `${mgr} start` : 'node index.js';
      return this._node('Node.js', startCmd, install, pkg, 3001);
    }

    // Spring Boot (Maven)
    if (files.includes('pom.xml')) {
      const cmd = fs.existsSync(path.join(projectPath, 'mvnw'))
        ? (process.platform === 'win32' ? '.\\mvnw.cmd spring-boot:run' : './mvnw spring-boot:run')
        : 'mvn spring-boot:run';
      return {
        type: 'Spring Boot', detected: true,
        command: cmd, installCmd: 'mvn install -DskipTests',
        port: 8080, ide: 'IntelliJ IDEA',
        steps: [{ label: 'Start Spring Boot', cmd, wait: false }],
      };
    }

    // Spring Boot (Gradle)
    if (files.includes('build.gradle') || files.includes('build.gradle.kts')) {
      const cmd = fs.existsSync(path.join(projectPath, 'gradlew'))
        ? (process.platform === 'win32' ? '.\\gradlew.bat bootRun' : './gradlew bootRun')
        : 'gradle bootRun';
      return {
        type: 'Spring Boot', detected: true,
        command: cmd, installCmd: '',
        port: 8080, ide: 'IntelliJ IDEA',
        steps: [{ label: 'Start Spring Boot', cmd, wait: false }],
      };
    }

    // Laravel
    if (files.includes('artisan') && files.includes('composer.json')) {
      return {
        type: 'Laravel', detected: true,
        command: 'php artisan serve',
        installCmd: 'composer install',
        port: 8080, ide: 'VS Code',
        steps: [
          { label: 'Install packages', cmd: 'composer install',  wait: true  },
          { label: 'Start server',     cmd: 'php artisan serve', wait: false },
        ],
      };
    }

    // Generic Python
    if (files.some(f => f.endsWith('.py'))) {
      const entry = files.includes('main.py') ? 'main.py' : files.find(f => f.endsWith('.py'));
      return {
        type: 'Python', detected: true,
        command: `python ${entry}`,
        installCmd: files.includes('requirements.txt') ? 'pip install -r requirements.txt' : '',
        port: null, ide: 'VS Code',
        steps: [{ label: 'Run script', cmd: `python ${entry}`, wait: false }],
      };
    }

    return this._empty();
  }

  _node(type, cmd, install, pkg, port) {
    return {
      type, detected: true, command: cmd, installCmd: install, port, ide: 'VS Code',
      steps: [
        { label: 'Install packages', cmd: install, wait: true  },
        { label: 'Start server',     cmd,          wait: false },
      ],
    };
  }

  _empty() {
    return { type: 'Custom', detected: false, command: '', installCmd: '', port: null, ide: 'VS Code', steps: [] };
  }

  _ls(dir)         { try { return fs.readdirSync(dir); }       catch { return []; } }
  _read(dir, file) { try { return fs.readFileSync(path.join(dir, file), 'utf8'); } catch { return ''; } }
  _readJson(dir, f){ try { return JSON.parse(this._read(dir, f)); } catch { return {}; } }
}
