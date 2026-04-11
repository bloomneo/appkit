/**
 * @fileoverview AppKit Generate Command - Smart project and feature scaffolding
 * @description Generates apps, features, and components using FBCA pattern with AppKit modules
 * @file appkit/bin/commands/generate.js
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main generate command router
 */
export async function generate(type, name, options = {}) {
  // Smart folder name detection if no name provided
  if (!name && type === 'app') {
    name = path.basename(process.cwd());
    console.log(`🔍 Detected project name: "${name}"`);
  }

  switch (type) {
    case 'app':
      await generateApp(name, options);
      break;
    case 'feature':
      await generateFeature(name, options);
      break;
    default:
      console.error(`❌ Unknown type "${type}". Use: app, feature`);
      console.log(`\n💡 Available commands:`);
      console.log(
        `  npx appkit generate app [name]     - Create full AppKit project`
      );
      console.log(
        `  npx appkit generate feature <name> - Add feature to existing project`
      );
      process.exit(1);
  }
}

/**
 * Generate a complete AppKit application with smart context detection
 */
async function generateApp(name, options) {
  try {
    const currentDir = process.cwd();
    const isCurrentDir = !name || name === path.basename(currentDir);
    const projectPath = isCurrentDir
      ? currentDir
      : path.resolve(currentDir, name);
    const projectName = name || path.basename(currentDir);

    console.log(
      `📁 Creating AppKit structure${isCurrentDir ? ' in current directory' : ` in "${name}"`}...`
    );

    const templatesPath = path.join(__dirname, '..', 'templates', 'backend');
    const createdFiles = [];
    const skippedFiles = [];

    // Check if we're adding to existing project
    const existingApiPath = path.join(projectPath, 'src', 'api');
    const hasExistingApi = await fileExists(existingApiPath);

    if (hasExistingApi) {
      console.log(
        '🔍 Detected existing src/api structure, adding missing files only...\n'
      );
    }

    // Create project directory if needed
    if (!isCurrentDir) {
      try {
        await fs.access(projectPath);
        console.log(
          `⚠️  Directory "${name}" already exists, adding files safely...`
        );
      } catch {
        await fs.mkdir(projectPath, { recursive: true });
        createdFiles.push(`📁 ${name}/`);
      }
    }

    // Generate shared random keys for the project
    const randomFrontendKey =
      'voila_' +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    const randomAuthSecret =
      'auth_' +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    const randomDefaultPassword =
      Math.random().toString(36).substring(2, 8) +
      Math.random().toString(36).substring(2, 6);

    // Copy backend structure with smart file handling
    await copyDirectorySafe(
      templatesPath,
      projectPath,
      projectName,
      createdFiles,
      skippedFiles,
      ['api.http.template'],
      randomFrontendKey,
      randomAuthSecret,
      randomDefaultPassword
    );

    // Handle package.json smartly
    await handlePackageJson(
      projectPath,
      projectName,
      createdFiles,
      skippedFiles
    );

    // Report results
    console.log(`\n📊 Summary:`);
    if (createdFiles.length > 0) {
      console.log(`✅ Created ${createdFiles.length} files:`);
      createdFiles.forEach((file) => console.log(`  ${file}`));
    }
    if (skippedFiles.length > 0) {
      console.log(`⚠️  Skipped ${skippedFiles.length} existing files:`);
      skippedFiles.forEach((file) => console.log(`  ${file}`));
    }

    // Install dependencies if package.json was created/updated
    if (
      createdFiles.some((f) => f.includes('package.json')) ||
      createdFiles.length > 2
    ) {
      console.log(`\n📦 Installing dependencies...`);
      await installDependencies(projectPath);
    }

    // Success message
    console.log(`\n🚀 AppKit project ready!`);
    console.log(`\n💡 Next steps:`);
    if (!isCurrentDir) {
      console.log(`  cd ${name}`);
    }
    console.log(`  npm run dev:api`);
    console.log(
      `\n🌐 Your API will be available at: http://localhost:3000/api`
    );
  } catch (error) {
    console.error('❌ Failed to generate app:', error.message);
    process.exit(1);
  }
}

/**
 * Generate a new feature in existing project
 */
async function generateFeature(name, options) {
  const withDb = options && options.db;
  const isUserFeature = name === 'user';

  console.log(
    `🔧 Generating ${isUserFeature ? 'user authentication feature' : `feature: "${name}"`}${withDb ? ' with database support' : ''}...\n`
  );

  try {
    // Validate feature name
    if (!name || !/^[a-zA-Z0-9-_]+$/.test(name)) {
      console.error(
        '❌ Invalid feature name. Use only letters, numbers, hyphens, and underscores.'
      );
      process.exit(1);
    }

    // Check if we're in a project directory
    const currentDir = process.cwd();
    const packageJsonPath = path.join(currentDir, 'package.json');

    try {
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, 'utf8')
      );
      if (
        !packageJson.dependencies ||
        !packageJson.dependencies['@bloomneo/appkit']
      ) {
        console.error(
          '❌ Not in an AppKit project directory. Run this from project root.'
        );
        console.log('💡 First run: npx appkit generate app');
        process.exit(1);
      }
    } catch {
      console.error('❌ No package.json found. Run this from project root.');
      process.exit(1);
    }

    // Validate FBCA structure
    const featuresPath = await validateFBCAStructure(currentDir);

    // Check if feature already exists
    const featurePath = path.join(featuresPath, name);
    try {
      await fs.access(featurePath);
      console.error(`❌ Feature "${name}" already exists.`);
      process.exit(1);
    } catch {
      // Feature doesn't exist, good to proceed
    }

    // Generate feature based on type
    if (isUserFeature) {
      await generateUserFeature(featuresPath, name, currentDir);
    } else {
      // Generate regular feature scaffolding
      await generateFeatureScaffolding(featuresPath, name, options);

      // Handle database integration if --db flag is used
      if (withDb) {
        await handleDatabaseIntegration(currentDir, name);
      }
    }

    console.log(
      `✅ Generated ${isUserFeature ? 'user authentication feature' : `feature "${name}"`} successfully!`
    );
    console.log(`\n📁 Files created:`);

    if (isUserFeature) {
      console.log(`  src/api/features/user/user.route.ts`);
      console.log(`  src/api/features/user/user.service.ts`);
      console.log(`  src/api/features/user/user.types.ts`);
      console.log(`  src/api/features/user/user.model.ts`);
      console.log(`  src/api/features/user/user.http`);
      console.log(`  prisma/seeding/user.seed.js`);
      console.log(`  prisma/schema.prisma (User model added)`);
    } else {
      console.log(`  src/api/features/${name}/${name}.route.ts`);
      console.log(`  src/api/features/${name}/${name}.service.ts`);
      console.log(`  src/api/features/${name}/${name}.types.ts`);
      if (withDb) {
        console.log(`  src/api/features/${name}/${name}.model.ts`);
        console.log(`  src/api/features/${name}/${name}.http`);
        console.log(`  prisma/seeding/${name}.seed.js`);
      }
    }

    console.log(`\n🚀 Feature available at: /api/${name}`);
    console.log(`\n💡 Next steps:`);

    if (isUserFeature) {
      console.log(
        `  1. Install dependencies: npm install prisma @prisma/client bcrypt`
      );
      console.log(
        `  2. Install dev dependencies: npm install -D @types/bcrypt`
      );
      console.log(`  3. Create database: npx prisma db push`);
      console.log(`  4. Generate Prisma client: npx prisma generate`);
      console.log(`  5. Seed user accounts: node prisma/seeding/user.seed.js`);
      console.log(`  6. Test authentication: Use user.http file in VS Code`);
      console.log(`  7. Start server: npm run dev:api`);
      console.log(
        `\n🔐 Complete authentication system with 9 role accounts ready!`
      );
      console.log(`🧪 Default password for all test accounts: Password123!`);
    } else if (withDb) {
      console.log(
        `  1. Install Prisma if needed: npm install prisma @prisma/client`
      );
      console.log(`  2. Create database: npx prisma db push`);
      console.log(`  3. Generate client: npx prisma generate`);
      console.log(`  4. Seed data: node prisma/seeding/${name}.seed.js`);
      console.log(`  5. Test API: Use ${name}.http file in VS Code`);
      console.log(`  6. Start server: npm run dev:api`);
      console.log(`\n🌱 Manual seeding gives you full control over your data!`);
    } else {
      console.log(`  1. Update ${name}.types.ts with your data types`);
      console.log(`  2. Implement business logic in ${name}.service.ts`);
      console.log(`  3. Test your API: curl http://localhost:3000/api/${name}`);
    }
  } catch (error) {
    console.error('❌ Failed to generate feature:', error.message);
    process.exit(1);
  }
}

/**
 * Copy directory recursively with safe non-destructive behavior
 */
async function copyDirectorySafe(
  src,
  dest,
  projectName,
  createdFiles,
  skippedFiles,
  excludeFiles = [],
  sharedFrontendKey = null,
  sharedAuthSecret = null,
  sharedDefaultPassword = null
) {
  await fs.mkdir(dest, { recursive: true });

  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    // Skip excluded files
    if (excludeFiles.includes(entry.name)) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectorySafe(
        srcPath,
        destPath,
        projectName,
        createdFiles,
        skippedFiles,
        excludeFiles,
        sharedFrontendKey,
        sharedAuthSecret
      );
    } else {
      // Remove .template extension for final path
      const finalDestPath = destPath.endsWith('.template')
        ? destPath.slice(0, -9)
        : destPath;

      // Check if file already exists
      const exists = await fileExists(finalDestPath);
      if (exists) {
        skippedFiles.push(path.relative(dest, finalDestPath));
        continue;
      }

      // Read and process template
      let content = await fs.readFile(srcPath, 'utf8');

      // Use shared keys or generate them if not provided
      const frontendKey =
        sharedFrontendKey ||
        'voila_' +
          Math.random().toString(36).substring(2, 15) +
          Math.random().toString(36).substring(2, 15);
      const authSecret =
        sharedAuthSecret ||
        'auth_' +
          Math.random().toString(36).substring(2, 15) +
          Math.random().toString(36).substring(2, 15) +
          Math.random().toString(36).substring(2, 15);
      const defaultPassword =
        sharedDefaultPassword ||
        Math.random().toString(36).substring(2, 8) +
          Math.random().toString(36).substring(2, 6);

      content = content
        .replace(/\{\{projectName\}\}/g, projectName)
        .replace(/\{\{randomFrontendKey\}\}/g, frontendKey)
        .replace(/\{\{frontendKey\}\}/g, frontendKey)
        .replace(/\{\{randomAuthSecret\}\}/g, authSecret)
        .replace(/\{\{randomDefaultPassword\}\}/g, defaultPassword);

      // Write file
      await fs.writeFile(finalDestPath, content);
      createdFiles.push(path.relative(dest, finalDestPath));
    }
  }
}

/**
 * Handle package.json creation/updating smartly
 */
async function handlePackageJson(
  projectPath,
  projectName,
  createdFiles,
  skippedFiles
) {
  const packageJsonPath = path.join(projectPath, 'package.json');
  const exists = await fileExists(packageJsonPath);

  if (exists) {
    // Update existing package.json
    try {
      const packageContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      let updated = false;

      // Add backend dependencies if missing
      packageJson.dependencies = packageJson.dependencies || {};
      if (!packageJson.dependencies['@bloomneo/appkit']) {
        packageJson.dependencies['@bloomneo/appkit'] = '^1.0.0';
        updated = true;
      }
      if (!packageJson.dependencies['express']) {
        packageJson.dependencies['express'] = '^4.18.2';
        updated = true;
      }
      if (!packageJson.dependencies['cors']) {
        packageJson.dependencies['cors'] = '^2.8.5';
        updated = true;
      }

      packageJson.devDependencies = packageJson.devDependencies || {};
      if (!packageJson.devDependencies['nodemon']) {
        packageJson.devDependencies['nodemon'] = '^3.0.1';
        updated = true;
      }
      if (!packageJson.devDependencies['tsx']) {
        packageJson.devDependencies['tsx'] = '^4.20.5';
        updated = true;
      }

      // Add scripts if they don't exist
      packageJson.scripts = packageJson.scripts || {};
      if (!packageJson.scripts['dev:api']) {
        packageJson.scripts['dev:api'] =
          'API_ONLY=true nodemon --exec tsx src/api/server.ts';
        updated = true;
      }
      if (!packageJson.scripts['build:api']) {
        packageJson.scripts['build:api'] = 'tsc --project tsconfig.api.json';
        updated = true;
      }
      if (!packageJson.scripts['start:api']) {
        packageJson.scripts['start:api'] = 'node dist/api/server.js';
        updated = true;
      }

      if (updated) {
        await fs.writeFile(
          packageJsonPath,
          JSON.stringify(packageJson, null, 2)
        );
        createdFiles.push('package.json (updated)');
      } else {
        skippedFiles.push('package.json (no changes needed)');
      }
    } catch (error) {
      skippedFiles.push('package.json (update failed)');
    }
  }
  // If package.json doesn't exist, it will be created by copyDirectorySafe
}

/**
 * Generate complete feature scaffolding using TypeScript templates
 */
async function generateFeatureScaffolding(featuresPath, name, options) {
  const featurePath = path.join(featuresPath, name);
  await fs.mkdir(featurePath, { recursive: true });

  // Choose template path based on --db flag
  const withDb = options && options.db;
  const templateDir = withDb ? 'feature-db' : 'feature';
  const templatesPath = path.join(__dirname, `../templates/${templateDir}`);

  try {
    // Generate core feature files
    await generateFromTemplate(
      templatesPath,
      'feature.route.ts.template',
      featurePath,
      `${name}.route.ts`,
      name
    );
    await generateFromTemplate(
      templatesPath,
      'feature.service.ts.template',
      featurePath,
      `${name}.service.ts`,
      name
    );
    await generateFromTemplate(
      templatesPath,
      'feature.types.ts.template',
      featurePath,
      `${name}.types.ts`,
      name
    );

    // Generate .http file for all features
    await generateFromTemplate(
      templatesPath,
      'feature.http.template',
      featurePath,
      `${name}.http`,
      name
    );

    console.log(`  ✅ Generated ${name}.route.ts`);
    console.log(`  ✅ Generated ${name}.service.ts`);
    console.log(`  ✅ Generated ${name}.types.ts`);
    console.log(`  ✅ Generated ${name}.http`);

    // Generate additional files for database features
    if (withDb) {
      await generateFromTemplate(
        templatesPath,
        'feature.model.ts.template',
        featurePath,
        `${name}.model.ts`,
        name
      );
      console.log(`  ✅ Generated ${name}.model.ts`);

      // Generate seeding files
      await generateSeedingFiles(templatesPath, name);
    }

    console.log(
      `✅ Created feature directory: ${name}/ ${withDb ? '(with database support)' : ''}`
    );
  } catch (error) {
    console.error(
      `❌ Failed to generate feature from templates: ${error.message}`
    );
    throw error;
  }
}

/**
 * Generate file from template with variable replacement
 */
async function generateFromTemplate(
  templatesPath,
  templateFile,
  outputPath,
  outputFile,
  featureName
) {
  try {
    // Read template file
    const templatePath = path.join(templatesPath, templateFile);
    const templateContent = await fs.readFile(templatePath, 'utf8');

    // Get project name from package.json
    const currentDir = process.cwd();
    const packageJsonPath = path.join(currentDir, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    const projectName = packageJson.name || path.basename(currentDir);

    // Get keys from .env file
    let frontendKey = 'frontend_dev_2024_test_key_12345'; // default
    let authSecret = 'auth_default_secret_12345678901234567890'; // default
    let defaultPassword = 'default123'; // default
    try {
      const envPath = path.join(currentDir, '.env');
      const envContent = await fs.readFile(envPath, 'utf8');
      const keyMatch = envContent.match(
        /VOILA_FRONTEND_KEY\s*=\s*["']?([^"'\n\r]+)["']?/
      );
      if (keyMatch) {
        frontendKey = keyMatch[1];
      }
      const authMatch = envContent.match(
        /VOILA_AUTH_SECRET\s*=\s*["']?([^"'\n\r]+)["']?/
      );
      if (authMatch) {
        authSecret = authMatch[1];
      }
      const passwordMatch = envContent.match(
        /DEFAULT_USER_PASSWORD\s*=\s*["']?([^"'\n\r]+)["']?/
      );
      if (passwordMatch) {
        defaultPassword = passwordMatch[1];
      }
    } catch (error) {
      // Use defaults if .env doesn't exist or can't be read
    }

    // Replace template variables
    const processedContent = templateContent
      .replace(/\{\{featureName\}\}/g, featureName)
      .replace(
        /\{\{FeatureName\}\}/g,
        featureName.charAt(0).toUpperCase() + featureName.slice(1)
      )
      .replace(/\{\{tableName\}\}/g, featureName)
      .replace(/\{\{projectName\}\}/g, projectName)
      .replace(/\{\{frontendKey\}\}/g, frontendKey)
      .replace(/\{\{randomAuthSecret\}\}/g, authSecret)
      .replace(/\{\{randomDefaultPassword\}\}/g, defaultPassword);

    // Write output file
    const outputFilePath = path.join(outputPath, outputFile);
    await fs.writeFile(outputFilePath, processedContent, 'utf8');
  } catch (error) {
    console.error(
      `❌ Failed to generate ${outputFile} from template ${templateFile}:`,
      error.message
    );
    throw error;
  }
}

/**
 * Handle database integration for --db flag
 */
async function handleDatabaseIntegration(projectDir, featureName) {
  try {
    console.log(`🗄️  Setting up database integration for ${featureName}...`);

    // Check if Prisma is installed
    const packageJsonPath = path.join(projectDir, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

    if (
      !packageJson.dependencies?.prisma &&
      !packageJson.devDependencies?.prisma
    ) {
      console.log(`📦 Installing Prisma...`);
      console.log(`⚠️  Please run: npm install prisma @prisma/client`);
    }

    // Check if prisma/schema.prisma exists
    const schemaPath = path.join(projectDir, 'prisma/schema.prisma');
    const schemaExists = await fileExists(schemaPath);

    if (!schemaExists) {
      // Create prisma directory and basic schema with first model
      await fs.mkdir(path.join(projectDir, 'prisma'), { recursive: true });

      const basicSchema = `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model ${featureName.charAt(0).toUpperCase() + featureName.slice(1)} {
  id        Int      @id @default(autoincrement())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`;

      await fs.writeFile(schemaPath, basicSchema);
      console.log(`✅ Created prisma/schema.prisma with ${featureName} model`);
    } else {
      // Schema exists, check if model already exists
      const schemaContent = await fs.readFile(schemaPath, 'utf8');
      const modelName =
        featureName.charAt(0).toUpperCase() + featureName.slice(1);
      const modelPattern = new RegExp(`model\\s+${modelName}\\s*\\{`, 'i');

      if (modelPattern.test(schemaContent)) {
        console.log(
          `⚠️  Model "${modelName}" already exists in schema. Skipping...`
        );
      } else {
        // Append new model to existing schema
        const newModel = `
model ${modelName} {
  id        Int      @id @default(autoincrement())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`;

        await fs.appendFile(schemaPath, newModel);
        console.log(`✅ Added ${modelName} model to existing schema`);
      }
    }

    console.log(
      `📊 Database integration ready! Run 'npx prisma generate' to update the client.`
    );
  } catch (error) {
    console.error(`❌ Failed to setup database integration: ${error.message}`);
    throw error;
  }
}

/**
 * Generate seeding files for database features
 */
async function generateSeedingFiles(templatesPath, featureName) {
  try {
    const currentDir = process.cwd();
    const seedingDir = path.join(currentDir, 'prisma', 'seeding');

    // Create seeding directory if it doesn't exist
    await fs.mkdir(seedingDir, { recursive: true });

    // Generate feature seed file
    const seedingTemplatesPath = path.join(templatesPath, 'seeding');
    await generateFromTemplate(
      seedingTemplatesPath,
      'feature.seed.js.template',
      seedingDir,
      `${featureName}.seed.js`,
      featureName
    );

    // Generate README if it doesn't exist
    const readmePath = path.join(seedingDir, 'README.md');
    const readmeExists = await fileExists(readmePath);
    if (!readmeExists) {
      await generateFromTemplate(
        seedingTemplatesPath,
        'README.md.template',
        seedingDir,
        'README.md',
        featureName
      );
      console.log(`  ✅ Generated seeding/README.md`);
    }

    console.log(`  ✅ Generated seeding/${featureName}.seed.js`);
  } catch (error) {
    console.error(`❌ Failed to generate seeding files: ${error.message}`);
    throw error;
  }
}

/**
 * Install dependencies
 */
function installDependencies(projectPath) {
  return new Promise((resolve, reject) => {
    const npm = spawn('npm', ['install'], {
      cwd: projectPath,
      stdio: 'inherit',
    });

    npm.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Dependencies installed');
        resolve();
      } else {
        reject(new Error(`npm install failed with code ${code}`));
      }
    });
  });
}

/**
 * Check if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate FBCA structure for feature generation
 */
async function validateFBCAStructure(projectDir) {
  const requiredPaths = [
    { path: 'src', name: 'src directory' },
    { path: 'src/api', name: 'src/api directory' },
    { path: 'src/api/features', name: 'features directory' },
    { path: 'src/api/lib', name: 'lib directory' },
    { path: 'src/api/server.ts', name: 'server.ts file' },
    { path: 'src/api/lib/api-router.ts', name: 'api-router.ts file' },
  ];

  const missingPaths = [];

  for (const required of requiredPaths) {
    const fullPath = path.join(projectDir, required.path);
    if (!(await fileExists(fullPath))) {
      missingPaths.push(required.name);
    }
  }

  if (missingPaths.length > 0) {
    console.error('❌ Inconsistent FBCA structure detected. Missing:');
    missingPaths.forEach((missing) => console.error(`   • ${missing}`));
    console.log('\n💡 To fix this, run: npx appkit generate app');
    console.log(
      '   This will safely add missing AppKit files without overwriting existing ones.'
    );
    process.exit(1);
  }

  return path.join(projectDir, 'src/api/features');
}

/**
 * Generate user authentication feature with complete setup
 */
async function generateUserFeature(featuresPath, name, projectDir) {
  const featurePath = path.join(featuresPath, name);
  await fs.mkdir(featurePath, { recursive: true });

  const templatesPath = path.join(__dirname, `../templates/feature-user`);

  try {
    // Generate user-specific files from templates
    await generateFromTemplate(
      templatesPath,
      'user.route.ts.template',
      featurePath,
      'user.route.ts',
      name
    );
    await generateFromTemplate(
      templatesPath,
      'user.service.ts.template',
      featurePath,
      'user.service.ts',
      name
    );
    await generateFromTemplate(
      templatesPath,
      'user.types.ts.template',
      featurePath,
      'user.types.ts',
      name
    );
    await generateFromTemplate(
      templatesPath,
      'user.model.ts.template',
      featurePath,
      'user.model.ts',
      name
    );
    await generateFromTemplate(
      templatesPath,
      'user.http.template',
      featurePath,
      'user.http',
      name
    );

    console.log(`  ✅ Generated user.route.ts`);
    console.log(`  ✅ Generated user.service.ts`);
    console.log(`  ✅ Generated user.types.ts`);
    console.log(`  ✅ Generated user.model.ts`);
    console.log(`  ✅ Generated user.http`);

    // Handle user database integration
    await handleUserDatabaseIntegration(projectDir);

    // Generate user seeding files
    await generateUserSeedingFiles(templatesPath, projectDir);

    console.log(`✅ Created user authentication feature with complete setup`);
  } catch (error) {
    console.error(
      `❌ Failed to generate user feature from templates: ${error.message}`
    );
    throw error;
  }
}

/**
 * Handle database integration for user feature
 */
async function handleUserDatabaseIntegration(projectDir) {
  try {
    console.log(`🗄️  Setting up user database integration...`);

    // Check if prisma/schema.prisma exists
    const schemaPath = path.join(projectDir, 'prisma/schema.prisma');
    const schemaExists = await fileExists(schemaPath);

    if (!schemaExists) {
      // Create prisma directory and schema with User model
      await fs.mkdir(path.join(projectDir, 'prisma'), { recursive: true });

      const userSchema = `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id                Int       @id @default(autoincrement())
  email             String    @unique
  password          String
  name              String?
  phone             String?
  role              String    @default("user")
  level             String    @default("basic")
  tenantId          String?
  isVerified        Boolean   @default(false)
  isActive          Boolean   @default(true)
  lastLogin         DateTime?
  resetToken        String?
  resetTokenExpiry  DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@map("users")
}
`;

      await fs.writeFile(schemaPath, userSchema);
      console.log(`✅ Created prisma/schema.prisma with User model`);
    } else {
      // Schema exists, check if User model already exists
      const schemaContent = await fs.readFile(schemaPath, 'utf8');
      const userModelPattern = /model\s+User\s*\{/i;

      if (userModelPattern.test(schemaContent)) {
        console.log(`⚠️  User model already exists in schema. Skipping...`);
      } else {
        // Append User model to existing schema
        const userModel = `
model User {
  id                Int       @id @default(autoincrement())
  email             String    @unique
  password          String
  name              String?
  phone             String?
  role              String    @default("user")
  level             String    @default("basic")
  tenantId          String?
  isVerified        Boolean   @default(false)
  isActive          Boolean   @default(true)
  lastLogin         DateTime?
  resetToken        String?
  resetTokenExpiry  DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@map("users")
}
`;

        await fs.appendFile(schemaPath, userModel);
        console.log(`✅ Added User model to existing schema`);
      }
    }

    // Create or update .env file with DATABASE_URL
    await ensureDatabaseUrl(projectDir);

    console.log(`📊 User database integration ready!`);
  } catch (error) {
    console.error(
      `❌ Failed to setup user database integration: ${error.message}`
    );
    throw error;
  }
}

/**
 * Generate user seeding files
 */
async function generateUserSeedingFiles(templatesPath, projectDir) {
  try {
    const seedingDir = path.join(projectDir, 'prisma', 'seeding');

    // Create seeding directory if it doesn't exist
    await fs.mkdir(seedingDir, { recursive: true });

    // Generate user seed file
    await generateFromTemplate(
      templatesPath,
      'user.seed.js.template',
      seedingDir,
      'user.seed.js',
      'user'
    );

    console.log(`  ✅ Generated seeding/user.seed.js`);
  } catch (error) {
    console.error(`❌ Failed to generate user seeding files: ${error.message}`);
    throw error;
  }
}

/**
 * Ensure DATABASE_URL, VOILA_AUTH_SECRET, and DEFAULT_USER_PASSWORD exist in .env
 */
async function ensureDatabaseUrl(projectDir) {
  const envPath = path.join(projectDir, '.env');

  try {
    // Check if .env exists
    let envContent = '';
    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch {
      // .env doesn't exist, will create it
    }

    let updated = false;

    // Check if DATABASE_URL already exists
    if (!envContent.includes('DATABASE_URL=')) {
      const databaseUrl = '\nDATABASE_URL="file:./dev.db"\n';
      envContent += databaseUrl;
      updated = true;
      console.log(`✅ Added DATABASE_URL to .env`);
    }

    // Check if VOILA_AUTH_SECRET already exists
    if (!envContent.includes('VOILA_AUTH_SECRET=')) {
      const authSecret =
        'auth_' +
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
      const authSecretLine = '\nVOILA_AUTH_SECRET=' + authSecret + '\n';
      envContent += authSecretLine;
      updated = true;
      console.log(`✅ Added VOILA_AUTH_SECRET to .env`);
    }

    // Check if DEFAULT_USER_PASSWORD already exists
    if (!envContent.includes('DEFAULT_USER_PASSWORD=')) {
      const defaultPassword =
        Math.random().toString(36).substring(2, 8) +
        Math.random().toString(36).substring(2, 6);
      const passwordLine = '\nDEFAULT_USER_PASSWORD=' + defaultPassword + '\n';
      envContent += passwordLine;
      updated = true;
      console.log(`✅ Added DEFAULT_USER_PASSWORD to .env`);
    }

    if (updated) {
      await fs.writeFile(envPath, envContent, 'utf8');
    }
  } catch (error) {
    console.error(`❌ Failed to setup .env file: ${error.message}`);
    throw error;
  }
}

// Legacy export for backward compatibility
export const createProject = (name, options) => generate('app', name, options);
