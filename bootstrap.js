const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/Services.jsm");

var button,menu,exportMenu,importMenu;

// On browser start, creates menu items
function loadIntoWindow(window) {
	var parentId=window.NativeWindow.menu.toolsMenuID
	exportMenu = window.NativeWindow.menu.add({
		name:"Export Tabs", 
		callback:function(){
			exportTabs(window);
		},
		parent:parentId
	})
	importMenu = window.NativeWindow.menu.add({
		name:"Import Tabs", 
		callback:function(){
			importTabs(window);
		},
		parent:parentId
	})	
}

// On browser close or addon remove, removes menu items
function unloadFromWindow(window) {
	if (!window) return;
	window.NativeWindow.menu.remove(exportMenu);
	window.NativeWindow.menu.remove(importMenu);
}

// Exports URLs to a text file
// The default path is in the 'path' variable
// First collects all open tabs' URLs in an array
// Then generates a file name of current date (YMD) and time (HMS)
// And writes the array of URLs to the file with that name to the default path
function exportTabs(window){
	var res=[]
	window.BrowserApp.tabs.forEach(function(tab){
		var addr=tab.window.location
    if(addr!="about:blank" && addr!="about:home")
      res.push(addr)
    else{
      var entries=tab.browser.__SS_data.entries
      var last=entries.length-1
      var zombieAddr=entries[last].url
  		if(zombieAddr!="about:blank" && zombieAddr!="about:home")
  			res.push(zombieAddr)
    }
	})
	res=res.join("\r\n")
	
	var path="/sdcard/Android/tabs_backup/"
	
	var d=new Date()
	try{
		var date=formatDate(d.getDate())
		var month=formatDate(d.getMonth()+1)
		var year=d.getFullYear()
		var hours=formatDate(d.getHours())
		var minutes=formatDate(d.getMinutes())
		var seconds=formatDate(d.getSeconds())
		var add=""+date+month+year+"_"+hours+minutes+seconds
	}catch(e){
		var add=d.getTime()
	}
	path+="backup_"+add+".txt"
	
	var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
	file.initWithPath(path);
	file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE,0644);	
	
	var foStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
	foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0); 
	var converter = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
	converter.init(foStream, "UTF-8", 0, 0);
	converter.writeString(res);
	converter.close(); 
	
	window.NativeWindow.toast.show("Tabs exported to: "+path,"long")
}

// Adds leading 0 to numbers (in date and time) if in range [0..9]
function formatDate(arg){
	if(arg<10) arg="0"+arg
	return arg
}

// Imports URLs from a text file and opens new tab for each URL
// First opens dialog window to select the file location
// Then reads the file and creates new tabs in the browser
function importTabs(window){
	let fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
	fp.init(window, "Import Tabs", Ci.nsIFilePicker.modeOpen);

  try{
  	fp.show();
  	var selectedFile=fp.file
  	if(!selectedFile) return
  	var url=Services.io.newFileURI(selectedFile).spec
  }catch(e){
    var url="file:///sdcard/Android/tabs_backup/import.txt"
  }

	var res=[]
	fetchData(window,url, function(data){
    if(/\r\n/.test(data))
      var data=data.split(/\r\n/)
    else
		  var data=data.split(/\n/)
    
		for(var i=0;i<data.length;i++){
			var url=data[i].trim()
			res.push(url)
		}
		res.forEach(function(link){
			window.BrowserApp.addTab(link)
		})
	})
}

// Reads data from the text file and runs callback with the retrieved text
function fetchData(window,url, onFinish) {
  let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
  try {
    xhr.open("GET", url, true);
  } catch (e) {
    window.NativeWindow.toast.show("File "+url+" not found","long")
  }
  
  xhr.onload = function onload(event) {
    if (xhr.status == 200 || xhr.status===0) {
      onFinish(xhr.responseText);
    }
  }
  xhr.onerror=function(event){
    var notFound=url.replace("file://","")
    window.NativeWindow.toast.show("File '"+notFound+"' not found","long")
  }
  
  xhr.send(null);
}

// ------------------------------------ System functions ------------------------------------

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
