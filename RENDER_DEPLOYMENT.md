# Render Deployment Checklist

## ✅ Pre-Deployment Checklist

### Repository Setup
- [ ] Code is pushed to GitHub/GitLab
- [ ] All files are committed (especially package.json, tsconfig.json)
- [ ] Build command works locally: `npm run build`
- [ ] Compiled files exist in `dist/` directory

### Render Service Configuration

#### Build & Deploy Settings
- [ ] **Build Command**: `npm ci && npm run build`
- [ ] **Start Command**: `node dist/index.js`
- [ ] **Environment**: Node
- [ ] **Node Version**: 18.17.0 or higher

#### Environment Variables
- [ ] `NODE_ENV=production`
- [ ] `RENDER=true`
- [ ] `GEMINI_API_KEY=your_api_key`
- [ ] Database credentials (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)

## 🚫 Common Mistakes to Avoid

### ❌ WRONG Start Commands
- `npm start` (this runs `node dist/index.js` but Render might override it)
- `node src/index.ts` (tries to run TypeScript directly)
- `node src/index.js` (compiled files are in dist/, not src/)

### ❌ WRONG Build Commands
- `npm install` only (doesn't build TypeScript)
- Missing build step entirely

## 🔧 Troubleshooting

### Error: "Unknown file extension .ts"
**Cause**: Render is trying to run TypeScript files directly
**Solution**: Ensure Start Command is `node dist/index.js`

### Error: "Cannot find module"
**Cause**: Build step failed or Start Command is wrong
**Solution**: 
1. Check build logs for compilation errors
2. Verify Start Command points to `dist/index.js`

### Build Success but Runtime Errors
**Cause**: Environment variables missing
**Solution**: Double-check all environment variables are set

## 📝 Deployment Steps

1. **Update Render Service Settings**
   - Go to Render Dashboard → Your Service → Settings
   - Update Build & Deploy configuration
   - Save changes

2. **Manual Deploy**
   - Click "Manual Deploy"
   - Select "Deploy latest commit"
   - Monitor build logs

3. **Verify Deployment**
   - Check build logs show TypeScript compilation
   - Verify application starts with `node dist/index.js`
   - Test health endpoint: `https://your-app.onrender.com/health`

## 📋 Build Log Verification

Your build logs should show:
```
Running build command 'npm ci && npm run build'...
✓ npm ci completed
✓ tsc compilation completed
✓ dist/ directory created with .js files

Running start command 'node dist/index.js'...
✓ Application started successfully
```

If you see TypeScript files (.ts) in the start command, the configuration is wrong.
