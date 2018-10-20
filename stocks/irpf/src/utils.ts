
function parseDate(input, format) {
    var parts = input.match(/(\d+)/g)
    var fmt = {};

    parts[fmt["YYYY"]] = 0;
    parts[fmt["DD"]] = 0;
    parts[fmt["MM"]] = 0;
    parts[fmt["hh"]] = 0;
    parts[fmt["mm"]] = 0;
    parts[fmt["ss"]] = 0;

    var i = 0;
    format = format || "YYYY-MM-DD hh:mm:ss";
    format.replace(/(YYYY|DD|MM|hh|mm|ss)/g,
        function(part) { fmt[part] = i++; }
    );

    return new Date(parts[fmt["YYYY"]], parts[fmt["MM"]] - 1, parts[fmt["DD"]],
        parts[fmt["hh"]], parts[fmt["mm"]], parts[fmt["ss"]]);
}
