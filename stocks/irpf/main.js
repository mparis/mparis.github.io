var FIELD_DATE_STR = "fecha";
var FIELD_HOUR_STR = "hora";
var FIELD_PRODUCT_STR = "producto";
var FIELD_ID_STR = "isin";
var FIELD_NUM_STR = "titulos";
var FIELD_PRICE_STR = "precio";
var FIELD_TOTAL_STR = "total";
var EXPECTED_FIELDS = [
    FIELD_DATE_STR,
    FIELD_HOUR_STR,
    FIELD_PRODUCT_STR,
    FIELD_ID_STR,
    FIELD_NUM_STR,
    FIELD_PRICE_STR,
    FIELD_TOTAL_STR
];
var TransactionType;
(function (TransactionType) {
    TransactionType[TransactionType["BUY"] = 0] = "BUY";
    TransactionType[TransactionType["SELL"] = 1] = "SELL";
})(TransactionType || (TransactionType = {}));
var StockTransactionsProcessor = /** @class */ (function () {
    function StockTransactionsProcessor() {
    }
    StockTransactionsProcessor.prototype.processFile = function (file) {
        var self = this;
        Papa.parse(file, {
            comments: "#",
            header: true,
            skipEmptyLines: true,
            complete: function (result, file) {
                console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
                console.log("Processing " + file.name + "...");
                console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
                self.processCsvResult(result, file);
                console.log(file.name + " succesful processed");
                console.log("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n\n");
            },
            error: function errorFn(error, file) {
                throw new Error("Error while parsing "
                    + file.name + "(" + error + ")");
            }
        });
    };
    StockTransactionsProcessor.prototype.checkParsing = function (csvResult, file) {
        var error = csvResult.errors[0];
        if (error) {
            throw new Error("Error while parsing "
                + file.name + "(" + JSON.stringify(error) + ")");
        }
        for (var _i = 0, EXPECTED_FIELDS_1 = EXPECTED_FIELDS; _i < EXPECTED_FIELDS_1.length; _i++) {
            var field = EXPECTED_FIELDS_1[_i];
            if (csvResult.meta.fields.indexOf(field) == -1) {
                throw new Error("Field '" + field + "' not found");
            }
        }
    };
    StockTransactionsProcessor.prototype.processCsvResult = function (csvResult, file) {
        this.checkParsing(csvResult, file);
        var format = "DD-MM-YYYY hh:mm";
        var prodoucts = {};
        for (var _i = 0, _a = csvResult.data; _i < _a.length; _i++) {
            var input = _a[_i];
            var dateStr = input.fecha + " " + input.hora;
            var date = parseDate(dateStr, format);
            if (isNaN(date.getTime())) {
                throw new Error("Invalid date: " + dateStr
                    + ". Expected format: " + format);
            }
            input.date = date;
            input.titulos = parseFloat(input.titulos);
            input.total = parseFloat(input.total);
            var product = prodoucts[input.isin];
            if (product == undefined) {
                product = {};
                product.name = input.producto;
                product.buys = [];
                product.sells = [];
                product.stocksRemaining = 0;
                prodoucts[input.isin] = product;
                product.buysTotal = 0;
                product.sellsTotal = 0;
            }
            else {
                if (input.date > product.prevDate) {
                    throw new Error("Not reversed dates (" +
                        input.date.toLocaleDateString() + " >= " +
                        product.prevDate.toLocaleDateString() + ")");
                }
                if (input.date == product.prevDate &&
                    input.type != product.prevType) {
                    throw new Error("Not reversed dates for same type (" +
                        input.date.toLocaleDateString() + " >= " +
                        product.prevDate.toLocaleDateString() + ")");
                }
            }
            product.prevDate = input.date;
            product.prevType = input.type;
            if (input.total <= 0) {
                input.type = TransactionType.BUY;
                input.total = Math.abs(input.total);
                input.titulos = Math.abs(input.titulos);
                product.stocksRemaining += input.titulos;
                product.buys.push(input);
                product.buysTotal += input.total;
            }
            else if (input.total > 0) {
                input.type = TransactionType.SELL;
                input.total = Math.abs(input.total);
                input.titulos = Math.abs(input.titulos);
                product.sells.push(input);
                product.sellsTotal += input.total;
            }
        }
        var stocksRemainingPeriod = 0;
        for (var isin in prodoucts) {
            var product = prodoucts[isin];
            var currentYear = 0;
            var buyTotalPeriod = 0;
            var sellTotalPeriod = 0;
            var gainTotal = 0;
            var buy = product.buys.pop();
            var stocksBuy = buy.titulos;
            stocksRemainingPeriod += stocksBuy;
            console.info(product.name, isin);
            for (var _b = 0, _c = product.sells.reverse(); _b < _c.length; _b++) {
                var sell = _c[_b];
                var year = sell.date.getFullYear();
                if (year > currentYear) {
                    console.info("TOTAL: ", sellTotalPeriod.toFixed(2), -buyTotalPeriod.toFixed(2), (sellTotalPeriod - buyTotalPeriod).toFixed(2));
                    console.info("");
                    console.info(year);
                    currentYear = year;
                    buyTotalPeriod = 0;
                    sellTotalPeriod = 0;
                }
                console.info(sell.date.toLocaleDateString(), sell.titulos, sell.total);
                sellTotalPeriod += sell.total;
                var stocksSell = sell.titulos;
                var buyTotal = 0;
                var maxIterations = 100;
                do {
                    var stocksToConsume = Math.min(stocksBuy, stocksSell);
                    product.stocksRemaining -= stocksToConsume;
                    stocksRemainingPeriod -= stocksToConsume;
                    stocksBuy -= stocksToConsume;
                    stocksSell -= stocksToConsume;
                    var buyToConsume = (stocksToConsume * buy.total) / buy.titulos;
                    buyTotal += buyToConsume;
                    var sellToConsume = (stocksToConsume * sell.total) / sell.titulos;
                    var gain = sellToConsume - buyToConsume;
                    gainTotal += gain;
                    console.info("\t", buy.date.toLocaleDateString(), stocksToConsume, -buyToConsume.toFixed(2), sellToConsume.toFixed(2), gain.toFixed(2));
                    if (stocksBuy == 0) {
                        if (product.buys === undefined || product.buys.length == 0) {
                            if (product.stocksRemaining > 0) {
                                throw new Error("Not enough buys");
                            }
                            console.info("Cartera vacia");
                            break;
                        }
                        buy = product.buys.pop();
                        stocksBuy = buy.titulos;
                        if (sell.date > buy.date) {
                            stocksRemainingPeriod += stocksBuy;
                        }
                    }
                    maxIterations--;
                } while (stocksSell > 0 && maxIterations > 0);
                if (maxIterations == 0) {
                    throw new Error("Max iterations reached");
                }
                console.info("\t", stocksRemainingPeriod, sell.total.toFixed(2), -buyTotal.toFixed(2), (sell.total - buyTotal).toFixed(2), gainTotal.toFixed(2));
                if (sell.date < buy.date) {
                    stocksRemainingPeriod += stocksBuy;
                }
                buyTotalPeriod += buyTotal;
            }
            console.info("TOTAL: ", sellTotalPeriod.toFixed(2), -buyTotalPeriod.toFixed(2), (sellTotalPeriod - buyTotalPeriod).toFixed(2));
            var finalValue = product.buysTotal - product.sellsTotal;
            var stockPrice = finalValue / product.stocksRemaining;
            console.info("");
            console.info("Titulos en cartera: " + product.stocksRemaining);
            console.info("total compras: " + product.buysTotal.toFixed(2), ", total ventas: " + product.sellsTotal.toFixed(2), ", valor cartera: ", finalValue.toFixed(2), ", precio accion: ", stockPrice.toFixed(2));
            console.info("");
        }
    };
    return StockTransactionsProcessor;
}());
function handleFileSelect(evt) {
    var files = evt.target.files; /* FileList */
    var output = [];
    for (var i = 0, f; f = files[i]; i++) {
        var processor = new StockTransactionsProcessor();
        processor.processFile(f);
    }
}
window.addEventListener("load", function (event) {
    document.getElementById('files').addEventListener('change', handleFileSelect, false);
}, false);
function parseDate(input, format) {
    var parts = input.match(/(\d+)/g);
    var fmt = {};
    parts[fmt["YYYY"]] = 0;
    parts[fmt["DD"]] = 0;
    parts[fmt["MM"]] = 0;
    parts[fmt["hh"]] = 0;
    parts[fmt["mm"]] = 0;
    parts[fmt["ss"]] = 0;
    var i = 0;
    format = format || "YYYY-MM-DD hh:mm:ss";
    format.replace(/(YYYY|DD|MM|hh|mm|ss)/g, function (part) { fmt[part] = i++; });
    return new Date(parts[fmt["YYYY"]], parts[fmt["MM"]] - 1, parts[fmt["DD"]], parts[fmt["hh"]], parts[fmt["mm"]], parts[fmt["ss"]]);
}
