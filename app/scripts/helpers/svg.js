const Handlebars = require('hbs');
const Graphics = require('../const/graphics');

Handlebars.registerHelper('svg', (key) => {
    const value = Graphics[key];
    return value;
});
