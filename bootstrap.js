const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/Services.jsm");

var button, menu, exportMenu, importMenu;
const BACKUP_FOLDER = '/sdcard/tabs_backup/';

function loadIntoWindow(window) {
  var parentId = window.NativeWindow.menu.toolsMenuID
  exportMenu = window.NativeWindow.menu.add({
    name:"Export Tabs", 
    callback:function(){
      exportTabs(window);
    },
    parent:parentId
  });
  
  importMenu = window.NativeWindow.menu.add({
    name:"Import Tabs", 
    callback:function(){
      importTabs(window);
    },
    parent:parentId
  });
}

function unloadFromWindow(window) {
  if (!window) return;
  window.NativeWindow.menu.remove(exportMenu);
  window.NativeWindow.menu.remove(importMenu);
}


// --------------------------- main ---------------------------

function exportTabs(window){
  var res = [];
  window.BrowserApp.tabs.forEach(function(tab){
    var addr = tab.window.location;
    var title = tab.window.document.title;
    if (!title) title = addr;
    
    if(validUrl(addr) || !tab.browser.__SS_data) {
      res.push(title + "\n" + addr);
    }
    else {
      var entries = tab.browser.__SS_data.entries;
      var last = entries.length - 1;
      var zombieAddr = entries[last].url;
      var zombieTitle = entries[last].title;
      
      if(!zombieTitle) zombieTitle = zombieAddr;
      if(validUrl(zombieAddr)) {
        res.push(zombieTitle + "\n" + zombieAddr);
      }
    }
  });
  res = res.join("\n\n");
  
  var path = BACKUP_FOLDER;
  
  var token = getUniqueToken();
  path += "backup_" + token + ".txt";
  writeFile(path, res);
  window.NativeWindow.toast.show("Tabs exported to: " + path, "long");
}

function importTabs(window){
  let fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
  fp.init(window, "Import Tabs", Ci.nsIFilePicker.modeOpen);

  try{
    fp.show();
    var selectedFile = fp.file;
    if(!selectedFile) return;
    var path = Services.io.newFileURI(selectedFile).spec;
  }
  catch(e){
    var path = "file://" + BACKUP_FOLDER + "import.txt";
  }

  var res = [];
  fetchData(window, path, function(data) {
    if (/\n\n/.test(data)) {
      var urls = data.split(/\n\n/);
      urls = urls.map(function(url) {
        return url.split(/\n/)[1];
      })
    }
    else if(/\r\n/.test(data)) {
      var urls = data.split(/\r\n/);
    }
    else {
      var urls = data.split(/\n/);
    }
    
    for (var i in urls) {
      var url = urls[i].trim();
      res.push(url);
      window.BrowserApp.addTab(url);
    }
  });
}


// --------------------------- utils ---------------------------

function validUrl(url) {
  return url != "about:blank" && url != "about:home";
}

function getUniqueToken() {
  var res = '';
  var d = new Date();
  
  try {
    var date = formatDate(d.getDate());
    var month = formatDate(d.getMonth() + 1);
    var year = d.getFullYear();
    var hours = formatDate(d.getHours());
    var minutes = formatDate(d.getMinutes());
    var seconds = formatDate(d.getSeconds());
    res = date + "-" + month + "-" + year + "_" + hours + "-" + minutes + "-" + seconds;
  }
  catch(e) {
    res = d.getTime();
  }
  
  return res;
}

function formatDate(arg) {
  return (arg < 10) ? '0'+arg: arg;
}

function writeFile(path, text) {
  var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
  file.initWithPath(path);
  file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE,0644);  
  
  var foStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
  foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0); 
  var converter = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
  converter.init(foStream, "UTF-8", 0, 0);
  converter.writeString(text);
  converter.close(); 
}

function fetchData(window, path, onFinish) {
  let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
  try {
    xhr.open("GET", path, true);
  }
  catch (e) {
    window.NativeWindow.toast.show("File '" + path + "' not found", "long");
  }
  
  xhr.onload = function onload(event) {
    if (xhr.status == 200 || xhr.status===0) {
      onFinish(xhr.responseText);
    }
  }
  xhr.onerror = function(event) {
    var path = path.replace("file://", "");
    window.NativeWindow.toast.show("File '" + path + "' not found","long");
  }
  
  xhr.send(null);
}


// --------------------------- addon manage ---------------------------

function startup(data, reason) {
  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    loadIntoWindow(domWindow);
  }
  Services.wm.addListener(windowListener);
}

function shutdown(data, reason) {
  if (reason == APP_SHUTDOWN) return;
  Services.wm.removeListener(windowListener);
  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    unloadFromWindow(domWindow);
  }
}

var windowListener = {
  onOpenWindow: function(aWindow) {
    let domWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
    domWindow.addEventListener("UIReady", function onLoad() {
      domWindow.removeEventListener("UIReady", onLoad, false);
      loadIntoWindow(domWindow);
    }, false);
  },
  onCloseWindow: function(aWindow) {},
  onWindowTitleChange: function(aWindow, aTitle) {}
};
