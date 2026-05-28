const fs = require('fs')
const path = require('path')
const ChildProcess = require('child_process')
const packager = require('electron-packager')

module.exports = function(grunt) {
  var authCode
  try {
    authCode = grunt.file.readJSON('secret/auth_code.json')
  } catch (e) {
    if (e.origError.code === 'ENOENT') {
      console.warn(
        'secret/auth_code.json is not found. CodeSigning is not available.'
      )
    }
  }
  const OSX_COMMON_NAME = authCode != null ? authCode.OSX_COMMON_NAME : ''
  const WIN_CERT_PASSWORD = authCode != null ? authCode.WIN_CERT_PASSWORD : ''

  var initConfig = {
    pkg: grunt.file.readJSON('package.json'),
    'create-windows-installer': {
      x64: {
        appDirectory: path.join(__dirname, 'dist', 'Boostnote-win32-x64'),
        outputDirectory: path.join(__dirname, 'dist'),
        authors: 'MAISIN&CO., Inc.',
        exe: 'Boostnote.exe',
        loadingGif: path.join(__dirname, 'resources/boostnote-install.gif'),
        iconUrl: path.join(__dirname, 'resources/app.ico'),
        setupIcon: path.join(__dirname, 'resources/dmg.ico'),
        certificateFile: path.join(__dirname, 'secret', 'authenticode_cer.p12'),
        certificatePassword: WIN_CERT_PASSWORD,
        noMsi: true
      }
    }
  }

  grunt.initConfig(initConfig)
  grunt.loadNpmTasks('grunt-electron-installer')

  grunt.registerTask('compile', function() {
    var done = this.async()
    var execPath =
      path.join('node_modules', '.bin', 'webpack') +
      ' --config webpack-production.config.js'
    grunt.log.writeln(execPath)
    ChildProcess.exec(
      execPath,
      {
        env: Object.assign({}, process.env, {
          BABEL_ENV: 'production',
          NODE_ENV: 'production'
        })
      },
      function(err, stdout, stderr) {
        grunt.log.writeln(stdout)

        if (err) {
          grunt.log.writeln(err)
          grunt.log.writeln(stderr)
          done(false)
          return
        }
        done()
      }
    )
  })

  grunt.registerTask('pack', function(platform) {
    var outDir = process.env.PACK_OUT_DIR || path.join(__dirname, 'dist')
    grunt.log.writeln(outDir)
    var done = this.async()
    var opts = {
      name: 'Boostnote',
      arch: 'x64',
      dir: __dirname,
      electronVersion: grunt.config.get('pkg.config.electron-version'),
      appVersion: grunt.config.get('pkg.version'),
      appBundleId: 'com.maisin.boost',
      asar: process.env.USE_ASAR === 'true',
      prune: true,
      overwrite: true,
      out: outDir,
      ignore: /node_modules\/ace-builds\/(?!src-min)|node_modules\/ace-builds\/(?=src-min-noconflict)|node_modules\/devicon\/icons|^\/browser|^\/secret|\.babelrc|\.gitignore|^\/\.gitmodules|^\/gruntfile|^\/readme.md|^\/webpack|^\/node_modules\/grunt/
    }
    switch (platform) {
      case 'win':
        Object.assign(opts, {
          platform: 'win32',
          icon: path.join(__dirname, 'resources/app.ico'),
          win32metadata: {
            CompanyName: 'MAISIN&CO., Inc.',
            LegalCopyright: '© 2015 MAISIN&CO., Inc. All rights reserved.',
            FileDescription: 'Boostnote',
            OriginalFilename: 'Boostnote',
            FileVersion: grunt.config.get('pkg.version'),
            ProductVersion: grunt.config.get('pkg.version'),
            ProductName: 'Boostnote',
            InternalName: 'Boostnote'
          }
        })
        packager(opts)
          .then(function(appPaths) {
            grunt.log.writeln('packaged: ' + appPaths.join(', '))
            done()
          })
          .catch(function(err) {
            grunt.log.writeln(err)
            done(err)
          })
        break
      case 'osx':
        Object.assign(opts, {
          platform: 'darwin',
          icon: path.join(__dirname, 'resources/app.icns'),
          appCategoryType: 'public.app-category.developer-tools'
        })
        packager(opts)
          .then(function(appPaths) {
            grunt.log.writeln('packaged: ' + appPaths.join(', '))
            done()
          })
          .catch(function(err) {
            grunt.log.writeln(err)
            done(err)
          })
        break
      case 'osx-arm64':
        Object.assign(opts, {
          arch: 'arm64',
          platform: 'darwin',
          icon: path.join(__dirname, 'resources/app.icns'),
          appCategoryType: 'public.app-category.developer-tools'
        })
        packager(opts)
          .then(function(appPaths) {
            grunt.log.writeln('packaged: ' + appPaths.join(', '))
            done()
          })
          .catch(function(err) {
            grunt.log.writeln(err)
            done(err)
          })
        break
      case 'linux':
        Object.assign(opts, {
          platform: 'linux',
          icon: path.join(__dirname, 'resources/app.png')
        })
        packager(opts)
          .then(function(appPaths) {
            grunt.log.writeln('packaged: ' + appPaths.join(', '))
            done()
          })
          .catch(function(err) {
            grunt.log.writeln(err)
            done(err)
          })
        break
    }
  })

  grunt.registerTask('codesign', function(platform) {
    var done = this.async()
    if (process.platform !== 'darwin') {
      done(false)
      return
    }

    ChildProcess.exec(
      `codesign --verbose --deep --force --timestamp=none --sign \"${OSX_COMMON_NAME}\" dist/Boostnote-darwin-x64/Boostnote.app`,
      function(err, stdout, stderr) {
        grunt.log.writeln(stdout)
        if (err) {
          grunt.log.writeln(err)
          grunt.log.writeln(stderr)
          done(false)
          return
        }
        done()
      }
    )
  })

  grunt.registerTask('zip', function(platform) {
    var done = this.async()
    switch (platform) {
      case 'osx':
        var execPath =
          'cd dist/Boostnote-darwin-x64 && zip -r -y -q ../Boostnote-mac.zip Boostnote.app'
        grunt.log.writeln(execPath)
        ChildProcess.exec(execPath, function(err, stdout, stderr) {
          grunt.log.writeln(stdout)
          if (err) {
            grunt.log.writeln(err)
            grunt.log.writeln(stderr)
            done(false)
            return
          }
          done()
        })
        break
      default:
        done()
        return
    }
  })

  function getTarget() {
    switch (process.platform) {
      case 'darwin':
        return 'osx'
      case 'win32':
        return 'win'
      case 'linux':
        return 'linux'
      default:
        return process.platform
    }
  }

  grunt.registerTask('build', function(platform) {
    if (platform == null) platform = getTarget()

    switch (platform) {
      case 'win':
        grunt.task.run(['compile', 'pack:win', 'create-windows-installer'])
        break
      case 'osx':
        grunt.task.run(['compile', 'pack:osx', 'codesign', 'zip:osx'])
        break
      case 'linux':
        grunt.task.run(['compile', 'pack:linux'])
        break
    }
  })

  grunt.registerTask('pre-build', function(platform) {
    if (platform == null) platform = getTarget()

    switch (platform) {
      case 'win':
        grunt.task.run(['compile', 'pack:win'])
        break
      case 'osx':
        grunt.task.run(['compile', 'pack:osx'])
        break
      case 'linux':
        grunt.task.run(['compile', 'pack:linux'])
    }
  })

  grunt.registerTask('bfm', function() {
    const Color = require('color')
    const parseCSS = require('css').parse

    function generateRule(selector, bgColor, fgColor) {
      if (bgColor.isLight()) {
        bgColor = bgColor.mix(fgColor, 0.05)
      } else {
        bgColor = bgColor.mix(fgColor, 0.1)
      }

      if (selector && selector.length > 0) {
        return `${selector} .cm-table-row-even { background-color: ${bgColor
          .rgb()
          .string()}; }`
      } else {
        return `.cm-table-row-even { background-color: ${bgColor
          .rgb()
          .string()}; }`
      }
    }

    const root = path.join(__dirname, 'node_modules/codemirror/theme/')

    const colors = fs
      .readdirSync(root)
      .filter(file => file !== 'solarized.css')
      .map(file => {
        const css = parseCSS(fs.readFileSync(path.join(root, file), 'utf8'))

        const rules = css.stylesheet.rules.filter(
          rule => rule.selectors && /\b\.CodeMirror$/.test(rule.selectors[0])
        )
        if (rules.length === 1) {
          let bgColor = Color('white')
          let fgColor = Color('black')

          rules[0].declarations.forEach(declaration => {
            if (
              declaration.property === 'background-color' ||
              declaration.property === 'background'
            ) {
              bgColor = Color(declaration.value.split(' ')[0])
            } else if (declaration.property === 'color') {
              const value = /^(.*?)(?:\s*!important)?$/.exec(
                declaration.value
              )[1]
              const match = /^rgba\((.*?),\s*1\)$/.exec(value)
              if (match) {
                fgColor = Color(`rgb(${match[1]})`)
              } else {
                fgColor = Color(value)
              }
            }
          })

          return generateRule(rules[0].selectors[0], bgColor, fgColor)
        }
      })
      .filter(value => !!value)

    // default
    colors.unshift(generateRule(null, Color('white'), Color('black')))
    // solarized dark
    colors.push(
      generateRule(
        '.cm-s-solarized.cm-s-dark',
        Color('#002b36'),
        Color('#839496')
      )
    )
    // solarized light
    colors.push(
      generateRule(
        '.cm-s-solarized.cm-s-light',
        Color('#fdf6e3'),
        Color('#657b83')
      )
    )

    fs.writeFileSync(
      path.join(__dirname, 'extra_scripts/codemirror/mode/bfm/bfm.css'),
      colors.join('\n'),
      'utf8'
    )
  })

  grunt.registerTask('default', ['build'])
}
