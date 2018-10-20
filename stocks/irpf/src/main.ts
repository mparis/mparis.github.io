
function handleFileSelect(evt) {
    var files = evt.target.files; /* FileList */

    var output = [];
    for (var i = 0, f; f = files[i]; i++) {
        var processor = new StockTransactionsProcessor();
        processor.processFile(f);
    }

}

window.addEventListener("load", function(event) {
    document.getElementById('files').addEventListener('change', handleFileSelect, false);
}, false);
