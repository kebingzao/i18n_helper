exports.config = {
  default_web_file: 'web_en.csv',
  project_identifier: 'project',
  api_key: 'xxxxxxxxxxxxxxxxxx'
};

mongoskin = require('mongoskin');
// 数据库名
exports.database = mongoskin.db(process.env.MONGOLAB_URI || "mongodb://localhost/airProjectLang");

// 管理相关东西
exports.admin = {
    // 删除项目需要输入该密码
    pwd: "kbz#@!"
};

// https://github.com/kissjs/node-mongoskin