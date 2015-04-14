/**
 * Module dependencies.
 */

var express = require('express')
    , r_web = require('./routes/web')
    , http = require('http')
    , path = require('path');

var app = express();

app.configure(function () {
    app.set('port', process.env.PORT || 5555);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.use(express.favicon(__dirname + '/public/images/favicon.ico'));
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.cookieParser('your secret here'));
    app.use(express.session());
    app.use(app.router);
    app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function () {
    app.use(express.errorHandler());
});

app.get('/web/', r_web.index);//WEB部分首页
app.get('/web/project/', r_web.showProject);//WEB部分首页
// 提示页面
app.get('/web/tip/:msg', r_web.showTip);
app.get('/web/other/checkTranslate', r_web.checkTranslate);//检查翻译的情况

//===================================================== 新的接口================
// 增加项目
app.get('/web/project/add', r_web.project.add);
app.post('/web/project/add', r_web.project.add);
// 修改项目
app.get('/web/project/:name/edit', r_web.project.edit);
app.post('/web/project/:name/edit', r_web.project.edit);
//列出该项目的详情
app.get('/web/project/:name/show', r_web.project.show);
//  删除该项目
app.post('/web/project/:name/delete', r_web.project.delete);
//  生成开发中使用语言文件
app.get('/web/project/:name/buildFile', r_web.project.buildFile);
app.get('/web/project/:name/buildFile/:ext', r_web.project.buildFile);
app.post('/web/project/:name/buildFile', r_web.project.buildFile);
// 下载js文件到本地
app.get('/web/project/:name/downloadFile', r_web.project.downloadFile);
app.post('/web/project/:name/downloadFile', r_web.project.downloadFile);
//  生成上平台用的CSV
app.get('/web/project/:name/exportCrowdinCSV', r_web.project.exportCrowdinCSV);
// 导入最新翻译结果(从crowdin上载最新的csv文件)
// TODO 这主要是为了导入其他语种的翻译，总的词条不会增加
app.get('/web/project/:name/importTranslate', r_web.project.importTranslate);

// 导入CSV 或者 json 文件(批量导入新的词条) 因为如果一次性有很多词条的话，要手动添加到手软
// todo 主要是增加词条
app.get('/web/project/:name/importFile', r_web.project.importFile);
app.post('/web/project/:name/importFile', r_web.project.importFile);

// 导入i18n 源文件
app.get('/web/project/:name/importI18nFile', r_web.project.importI18nFile);
app.post('/web/project/:name/importI18nFile', r_web.project.importI18nFile);


// 添加一种语言
app.get('/web/project/:name/list/add', r_web.list.add);
app.post('/web/project/:name/list/add', r_web.list.add);
// 编辑语言
app.get('/web/project/:name/list/edit', r_web.list.edit);
app.post('/web/project/:name/list/edit', r_web.list.edit);
//列出某个项目某个语言的所有词条
app.get('/web/project/:name/list/:lang', r_web.lang.show);

// 添加一个词条
app.get('/web/project/:name/lang/add', r_web.lang.add);
app.post('/web/project/:name/lang/add', r_web.lang.add);

// 批量导入多个词条
app.get('/web/project/:name/lang/multiAdd', r_web.lang.multiAdd);
app.post('/web/project/:name/lang/multiAdd', r_web.lang.multiAdd);

// 修改词条的key
app.get('/web/project/:name/lang/editKey', r_web.lang.editKey);
app.post('/web/project/:name/lang/editKey', r_web.lang.editKey);

// 删除一个词条
app.get('/web/project/:name/:lang/del/:id', r_web.lang.delete);
// 更新一个词条
app.post('/web/project/:name/:lang/update/:id', r_web.lang.update);
// 审核一条本地维护语言的key
app.post('/web/project/:name/:lang/verify', r_web.lang.verify);

// 操作成功
app.get('/web/project/:name/success/:msg', r_web.project.operateSuccess);

// 输出js 内容
app.get('/web/project/:name/getFile/:file', r_web.project.getFile);

// 导入crowdin zip 包
app.get('/web/project/:name/importCrowdinZip', r_web.project.importCrowdinZip);
app.post('/web/project/:name/importCrowdinZip', r_web.project.importCrowdinZip);

// 使用 crowdin api 下载到翻译结果
app.get('/web/project/:name/downloadTranslation', r_web.project.downloadTranslation);

// 使用 crowdin api 生成最新翻译结果
app.get('/web/project/:name/refreshTranslation', r_web.project.refreshTranslation);
// 检查本地翻译结果
app.get('/web/project/:name/checkLocalTranslation', r_web.project.checkLocalTranslation);

// 上传翻译文件到平台
app.get('/web/project/:name/uploadTranslation', r_web.project.uploadTranslation);
app.post('/web/project/:name/uploadTranslation', r_web.project.uploadTranslation);

// 将翻译的zip下载到本地来
app.get('/web/project/:name/downloadLocalTranslation', r_web.project.downloadLocalTranslation);

// 设置本地维护语言
app.get('/web/project/:name/showLocalLang', r_web.project.showLocalLang);
app.post('/web/project/:name/addLocalLang', r_web.project.addLocalLang);
app.post('/web/project/:name/delLocalLang', r_web.project.delLocalLang);
http.createServer(app).listen(app.get('port'), function () {
    console.log("Express server listening on port " + app.get('port'));
});
