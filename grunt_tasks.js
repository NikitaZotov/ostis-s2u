module.exports = function () {

    var kb = 'kb/s2u/';
    var components = 'sc-web/components/s2u/';
    var clientJsDirPath = '../sc-web/client/static/components/js/';
    var clientCssDirPath = '../sc-web/client/static/components/css/';
    var clientHtmlDirPath = '../sc-web/client/static/components/html/';
    var clientImgDirPath = '../sc-web/client/static/components/images/';
    var commonJsDirPath = '../sc-web/client/static/common/';

    return {
        concat: {
            s2ucmp: {
                src: [
                    components + 'src/s2u-keynode-handler.js',
                    components + 'src/s2u.js',
                    components + 'src/s2u-debug.js',
                    components + 'src/s2u-math.js',
                    components + 'src/s2u-model-objects.js',
                    components + 'src/s2u-alphabet.js',
                    components + 'src/s2u-render.js',
                    components + 'src/s2u-scene.js',
                    components + 'src/s2u-legend.js',
                    components + 'src/s2u-layout.js',
                    components + 'src/s2u-tree.js',
                    components + 'src/s2u-struct.js',
                    components + 'src/s2u-object-creator.js',
                    components + 'src/s2u-template-finder.js',
                    components + 'src/s2u-objects-handler.js',
                    components + 'src/s2u-component.js',
                    components + 'src/listener/s2u-mode-bus.js',
                    components + 'src/listener/s2u-mode-contour.js',
                    components + 'src/listener/s2u-mode-edge.js',
                    components + 'src/listener/s2u-mode-link.js',
                    components + 'src/listener/s2u-mode-select.js',
                    components + 'src/command/append-object.js',
                    components + 'src/command/command-manager.js',
                    components + 'src/command/create-node.js',
                    components + 'src/command/create-edge.js',
                    components + 'src/command/create-link.js',
                    components + 'src/command/create-bus.js',
                    components + 'src/command/create-contour.js',
                    components + 'src/command/change-idtf.js',
                    components + 'src/command/change-content.js',
                    components + 'src/command/change-type.js',
                    components + 'src/command/delete-objects.js',
                    components + 'src/command/move-object.js',
                    components + 'src/command/move-line-point.js',
                    components + 'src/command/get-node-from-memory.js',
                    components + 'src/command/wrapper-command.js'],
                dest: clientJsDirPath + 's2u/s2u.js'
            }
        },
        copy: {
            s2uIMG: {
                cwd: components + 'static/components/images/s2u',
                src: ['**'],
                dest: clientImgDirPath + 's2u/',
                expand: true
            },
            s2uCSS: {
                cwd: components + 'static/components/css/',
                src: ['s2u.css'],
                dest: clientCssDirPath,
                expand: true,
                flatten: true
            },
            s2uJs: {
                cwd: components + 'static/common/js/',
                src: ['**'],
                dest: commonJsDirPath,
                expand: true,
                flatten: false
            },
            s2uHTML: {
                cwd: components + 'static/components/html/',
                src: ['*.html'],
                dest: clientHtmlDirPath,
                expand: true,
                flatten: true
            },
            kb: {
                cwd: kb,
                src: ['**'],
                dest: '../kb/s2u_drawings/',
                expand: true
            }
        },
        watch: {
            s2ucmp: {
                files: components + 'src/**',
                tasks: ['concat:s2ucmp']
            },
            s2uIMG: {
                files: [components + 'static/components/images/**'],
                tasks: ['copy:s2uIMG']
            },
            s2uCSS: {
                files: [components + 'static/components/css/**'],
                tasks: ['copy:s2uCSS']
            },
            s2uHTML: {
                files: [components + 'static/components/html/**',],
                tasks: ['copy:s2uHTML']
            },
            copyKB: {
                files: [kb + '**',],
                tasks: ['copy:kb']
            },
            s2uJs: {
                files: [components + 'static/common/js/**',],
                tasks: ['copy:s2uJs']
            }
        },
        exec: {
            updateCssAndJs: 'sh add-css-and-js.sh'
        }
    }
};