var fs = require('fs')
    , path = require('path')
    , readline = require('readline')
    , request = require('request')
    , progress = require('request-progress')
    , ProgressBar = require('progress')
    , open = require('open')
    , colors = require('colors')
    , List = require('term-list');

var bar = new ProgressBar('正在下载：:title [:bar] :percent :etas', {
    complete: '=',
    incomplete: ' ',
    width: 20,
    clear: true,
    total: 100
});

var currFm = '';
var playList = null;
var isDownloading = -1;   // which music is downloading
// make download dir if not exists
var downloadDir = './downloads'
if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
}

var menu = new List({ marker: '>'.red + ' ', markerLength: 2 });
menu.on('keypress', function(key, index) {
    if (key.name === 'return') {
        if (index == -5) {
            open('https://github.com/stanzhai/luoo-down');
        }
        if(index == -4){
            downloadMP3All(1);
        }
        if (index < 0 || isDownloading != -1) {
            return;
        }
        var mp3Info = playList[index];
        downloadMP3(mp3Info);
    } else if (key.name === 'q') {
        return menu.stop();
    }
});

function getFm(fmUrl) {
    console.log('正在获取期刊信息...'.yellow);
    request(fmUrl, function (err, res, html) {
        // parse fm info and make music dir
        playList = JSON.parse(findContent(html, 'var volPlaylist = ', '}];', 2));
        var fmTitle = findContent(html, '<h1 class="fm-title">', '</h1>', 0);
        currFm = fmTitle;
        var fmIntro = findContent(html, '<p class="fm-intro">', '</p>', 0);
        var fmCover = 'http://img' + findContent(html, 'http://img', '"', 0);
        var fmPath = path.join(downloadDir, fmTitle);
        var introPath = path.join(downloadDir, fmTitle, fmTitle + '.txt');
        var coverPath = path.join(downloadDir, fmTitle, fmTitle + '.jpg')
        if (!fs.existsSync(fmPath)) {
            fs.mkdirSync(fmPath);
            fs.writeFile(introPath, fmIntro.replace(/<br>/g, '\r\n').trim());
            request(fmCover).pipe(fs.createWriteStream(coverPath));
        }
        setMenuInfo();
    });
}

function findContent(html, key, endTag, offset) {
    var start = html.indexOf(key);
    var end = html.indexOf(endTag, start);
    return html.substring(start + key.length, end + offset);
}

function setMenuInfo() {
    menu.add(-1, '[期刊名]:' + currFm);
    menu.add(-2, Array(60).join('-'));
    for (var i = 0; i < playList.length; i++) {
        var info = playList[i];
        menu.add(i, (i + 1) + '. ' + info.title + '[' + (info.artist + '-' + info.album).green + ']');
    };
    menu.add(-3, Array(60).join('-'));
    menu.add(-4,'download all'.red.underline);
    menu.add(-5, 'Fork me on GitHub: luoo-down by Stan Zhai, 2014-5-24 night'.grey.underline);
    menu.start();
    menu.select(0);
}

function downloadMP3(mp3Info) {
    var coverFile = path.join(downloadDir, currFm, mp3Info.title + '.jpg');
    request(mp3Info.poster).pipe(fs.createWriteStream(coverFile));

    var mp3File = path.join(downloadDir, currFm, mp3Info.title + '.mp3');
    if (!fs.existsSync(mp3File)) {
        var lastReceived = 0;
        progress(request(mp3Info.mp3))
            .on('progress', function (state) {
                isDownloading = mp3Info.id;
                bar.total = state.total;
                bar.tick(state.received - lastReceived, {title: mp3Info.title});
                lastReceived = state.received;
            })
            .pipe(fs.createWriteStream(mp3File))
            .on('close', function (err) {
                // download ended, reset bar state
                bar.tick(bar.total - bar.curr);
                bar.curr = 0;
                isDownloading = -1;
            });
    } else {
        open(mp3File);
    }

}

function downloadMP3All(index){
    index = index || 1;
    if(playList.length>index){
        bar.tick(bar.total - bar.curr);
        bar.curr = 0;
        isDownloading = -1;
    }
    menu.select(index);
    var mp3Info = playList[index-1];
    if(fs.existsSync(mp3File)){
        index++;
        downloadMP3All(index);
        return;
    }

    var coverFile = path.join(downloadDir, currFm, mp3Info.title + '.jpg');
    request(mp3Info.poster).pipe(fs.createWriteStream(coverFile));

    var mp3File = path.join(downloadDir, currFm, mp3Info.title + '.mp3');
    var lastReceived = 0;
    progress(request(mp3Info.mp3))
        .on('progress', function (state) {
            isDownloading = mp3Info.id;
            bar.total = state.total;
            bar.tick(state.received - lastReceived, {title: mp3Info.title});
            lastReceived = state.received;
        })
        .pipe(fs.createWriteStream(mp3File))
        .on('close', function (err) {
            index++;
            downloadMP3All(index);
        });
}

function setError(err) {
    console.log(err.red);
}

function main() {
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    console.log('请输入您喜欢的落网期刊地址或期刊号\r\n如：http://www.luoo.net/music/613或613');
    var ask = '默认[http://www.luoo.net]:';
    rl.question(ask, function(answer) {
        if (/^\d+$/.test(answer)) {
            answer = 'http://www.luoo.net/music/' + answer;
        } else {
            answer = answer || 'http://www.luoo.net';
        }
        getFm(answer);
        rl.close();
    });
}

process.on('uncaughtException', function(err) {
    setError(err.message + '\r\n这个错误有可能是您输入了错误的期刊导致');
    main();
});

main();

