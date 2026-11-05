'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPOSITORY_ACTIONS = new Set(['blob', 'commits', 'edit', 'new', 'raw']);
const warnedTemplatePaths = new Set();

function cleanPath(value) {
  return String(value || '').trim().replace(/^\/+|\/+$/g, '');
}

function encodePath(value) {
  return cleanPath(value)
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

hexo.extend.helper.register('article_image_url', function articleImageUrl(post) {
  const image = typeof post.image === 'string' ? post.image.trim() : '';

  if (!image) {
    return '';
  }

  if (/^(?:https?:)?\/\//i.test(image)) {
    return image;
  }

  const normalizedImage = image.replace(/^\.?\//, '');
  const imagePath = normalizedImage.includes('/')
    ? normalizedImage
    : `img/${normalizedImage}`;

  return this.url_for(imagePath);
});

hexo.extend.helper.register('repository_file_url', function repositoryFileUrl(action, filePath) {
  const resources = this.site?.data?.resources || {};
  const repositoryUrl = String(resources.repository_url || '').replace(/\/+$/, '');
  const branch = encodeURIComponent(String(resources.branch || '').trim());
  const encodedFilePath = encodePath(filePath);

  if (!REPOSITORY_ACTIONS.has(action) || !repositoryUrl || !branch || !encodedFilePath) {
    return '';
  }

  return `${repositoryUrl}/${action}/${branch}/${encodedFilePath}`;
});

hexo.extend.helper.register('repository_new_file_url', function repositoryNewFileUrl(directory) {
  const newFileUrl = this.repository_file_url('new', directory);
  const resources = this.site?.data?.resources || {};
  const filename = String(resources.new_post_filename || '').trim();
  const templateFile = cleanPath(resources.new_post_template_file);

  if (!newFileUrl) {
    return '';
  }

  const parameters = new URLSearchParams();

  if (filename) {
    parameters.set('filename', filename);
  }

  if (templateFile) {
    const projectRoot = path.resolve(hexo.base_dir);
    const templatePath = path.resolve(projectRoot, templateFile);
    const isInsideProject = templatePath.startsWith(`${projectRoot}${path.sep}`);

    if (isInsideProject) {
      try {
        parameters.set('value', fs.readFileSync(templatePath, 'utf8'));
      } catch (error) {
        if (!warnedTemplatePaths.has(templatePath)) {
          warnedTemplatePaths.add(templatePath);
          hexo.log.warn(`Unable to read new article template at ${templateFile}: ${error.message}`);
        }
      }
    } else if (!warnedTemplatePaths.has(templatePath)) {
      warnedTemplatePaths.add(templatePath);
      hexo.log.warn(`New article template must be inside the Hexo project: ${templateFile}`);
    }
  }

  const query = parameters.toString();
  return query ? `${newFileUrl}?${query}` : newFileUrl;
});

hexo.extend.helper.register('repository_content_url', function repositoryContentUrl(action, sourcePath) {
  const resources = this.site?.data?.resources || {};
  const contentRoot = cleanPath(resources.content_root);
  const relativeSourcePath = cleanPath(sourcePath);

  if (!contentRoot || !relativeSourcePath) {
    return '';
  }

  return this.repository_file_url(action, `${contentRoot}/${relativeSourcePath}`);
});
