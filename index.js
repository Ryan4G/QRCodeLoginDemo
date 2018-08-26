/* 
 * index.js 
 * 
 */

// -----BEGIN MODULE SCOPE VARIABLES-----

var 
  http = require('http'),
  express = require('express'),
  qrcode = require('qr-image'),

  app = express(),
  path = require('path'),
  server = http.createServer(app),
  
  url = require('url'),
  fs = require('fs'),
  UUID = require('uuid-js'),

  generateHTML = null,
  writeDataFile = null,
  readDataFile = null;

// -----END MODULE SCOPE VARIABLES-----

// -----BEGIN SERVER CONFIGURATION-----

app.use(express.static('public'));

/*
 * Description: 读取网页文件，用于替换关键字，相当于简易模板
 * Params: 
 * sessionID - 生成的uid
 * req - 网页请求
 * res - 网页应答
 * fileName - 网页文件所在路径
 */
generateHTML = function(sessionID, req, res, fileName){

  fs.readFile(fileName, 'UTF-8', function(err, data) { 
      if(!err){

        data = data.replace(/SESSION_UID/g, sessionID);  
        res.writeHead(200, {  
            'Content-Type' : 'text/html; charset=UTF-8'  
        });  
        res.end(data);  
      }
      else{
        console.log(err);

        res.writeHead(404, {  
          'Content-Type' : 'text/html; charset=UTF-8'  
      });  
        res.end();  
      }
  });  

};

/*
 * Description: 写入JSON文件
 * Params: 
 * fileName - JSON文件所在路径
 * uid - 生成的uid
 * writeData - 需要写入的JSON格式数据
 * 
 */
setJSONValue = function(fileName, uid, writeData){

  let data = fs.readFileSync(fileName);

  let users = JSON.parse(data.toString());
  let addFlag = true;
  let delFlag = (writeData === null);

  for (let i = 0; i < users.data.length; i++){
    if (users.data[i].uid === uid){
      addFlag = false;

      if (delFlag){
        users.data.splice(i,1);
      }
      else{
        users.data[i].status = writeData.status;

        console.log("writeJSON: " + JSON.stringify(users.data[i]) + " modified.");
      }
    }
  }

  if(addFlag){
    users.data.push(writeData);
    console.log("writeJSON: " + JSON.stringify(writeData) + " inserted.");
  }

  // 同步写入文件
  let writeJSON = JSON.stringify(users);
  fs.writeFileSync(fileName, writeJSON);
}

/*
 * Description: 读取JSON文件（要返回数据，选择同步读取）
 * Params: 
 * fileName - JSON文件所在路径
 * uid - 生成的uid
 * 
 */
getJSONValue = function(fileName, uid){

  let readData = null;

  // 同步读取文件
  let data = fs.readFileSync(fileName);
        
  let users = JSON.parse(data.toString());

  for (let i = 0; i < users.data.length; i++){
    if (users.data[i].uid === uid){
      readData = JSON.stringify(users.data[i]);
      break;
    }
  }

  return readData;
}

// 显示网站首页
app.get('/', function (req, res) {
  // 生成唯一的ID
  let uid = UUID.create();
  console.log("uid: '" + uid + "' generated.");
  // 替换网页模板内的UID关键字
  generateHTML(uid, req, res, path.join(__dirname, '/views/main.html'));
});

// 生成二维码图片并显示
app.get('/qrcode', function (req, res, next) {
  
  let uid = url.parse(req.url, true).query.uid;

  try {
    if (typeof(uid) !== "undefined"){
      
      // 写入二维码内的网址，微信扫描后自动跳转
      let jumpURL = "http://192.168.10.203:3000/scanned?uid=" + uid;
      // 生成二维码(size：图片大小， margin: 边框留白)
      var img = qrcode.image(jumpURL, {size :6, margin: 2});
      res.writeHead(200, {'Content-Type': 'image/png'});
      img.pipe(res);
    }
    else{
      res.writeHead(414, {'Content-Type': 'text/html'});
      res.end('<h1>414 Request-URI Too Large</h1>');
    }
  } catch (e) {
    res.writeHead(414, {'Content-Type': 'text/html'});
    res.end('<h1>414 Request-URI Too Large</h1>');
  }
});

// 显示手机扫描后的确认界面
app.get('/scanned', function(req, res){

  let uid = url.parse(req.url, true).query.uid;

  if (typeof(uid) !== "undefined"){

    generateHTML(uid, req, res, path.join(__dirname, '/views/confirm.html'));

    console.log("uid: '" + uid + "' scanned.");

    // 获取JSON文件内对应uid的数据，更改其数据状态
    let jsonData = getJSONValue(path.join(__dirname, '/bin/data.json'), uid);
    
    if(jsonData === null){
      jsonData = {
        uid: uid,
        status: "scanned",
        name: "USER"
      }
    }
    else{
      jsonData = JSON.parse(jsonData);
      jsonData.status = "scanned";
    }

    // 写入JSON文件
    setJSONValue(path.join(__dirname, '/bin/data.json'), uid, jsonData);
  }
  else{
    res.writeHead(414, {'Content-Type': 'text/html'});
    res.end('<h1>414 Request-URI Too Large</h1>');
  }
});

// 在确认界面操作的响应
app.get('/confirmed', function(req, res){
  let uid = url.parse(req.url, true).query.uid;
  let operate = url.parse(req.url, true).query.operate;

  if (typeof(uid) !== "undefined"){

    console.log("uid: '" + uid + "' " + operate);

    let jsonData = getJSONValue(path.join(__dirname, '/bin/data.json'), uid);
    let status = (operate === "confirm") ? "verified" : "canceled";
    
    if(jsonData === null){
      jsonData = {
        uid: uid,
        status: status,
        name: "USER"
      }
    }
    else{
      jsonData = JSON.parse(jsonData);
      jsonData.status = status;
    }

    setJSONValue(path.join(__dirname, '/bin/data.json'), uid, jsonData);

    if (status === "verified"){
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end('<h1>Verified!</h1>');
    }
    else{
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end('<h1>Canceled!</h1>');
    }
  }
  else{
    res.writeHead(414, {'Content-Type': 'text/html'});
    res.end('<h1>414 Request-URI Too Large</h1>');
  }
});

// 响应主页不断的AJAX请求
app.get('/verified', function(req, res){
  
  let uid = url.parse(req.url, true).query.uid;

  // normal   - 没有任何触发
  // scanned  - 已扫描
  // canceled - 已取消
  // verified - 已验证
  let dataStatus = {
    cmd: "normal",
    user: ""
  }

  console.log("uid: '" + uid + "' query ...");

  if (typeof(uid) !== "undefined"){
    
    let userData = getJSONValue(
      path.join(__dirname, '/bin/data.json'), 
      uid
    );

    // 返回JSON数据用于首页AJAX操作
    if(userData !== null){
      userData = JSON.parse(userData);
      dataStatus.cmd = userData.status;
      dataStatus.user = userData.name;
    }
  }

  res.end(JSON.stringify(dataStatus));

});


// -----END SERVER CONFIGURATION-----

// -----BEGIN START SERVER-----

server.listen(3000);
console.log(
  'Express server listening on port %d in %s mode',
  server.address().port, app.settings.env
);

//-----EDULE START SERVER-----

