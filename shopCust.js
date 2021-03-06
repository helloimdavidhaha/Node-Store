const mysql = require('mysql');
const inquirer = require('inquirer');
const Format = require('format-number');
const colors = require('colors');
const format = Format({prefix: '$', integerSeparator: ',', negativeLeftOut: true});
const divider = '\n--------------------------------------------------\n';
var products = 0;

const connection = mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'bamazon'
});

connection.connect(function (err) {
    if (err) throw err;
    // console.log(`Connected to mySql with ID: ${connection.threadId}`);
    connection.query('SELECT * FROM products', function(err, res) {
        if (err) throw err;
        products = res.length;
    })
    console.log(divider);
    console.log(`\t     Welcome to Shoppingtons!`.rainbow);
    console.log(divider);
    preprompt(prompt);
});

function preprompt(func) {
    inquirer.prompt(
        {
            name: "choice",
            message: "What would you like to do today?",
            type: "list",
            choices: ["Shop all", "Search for item", "Quit"]
        }
    ).then(function (answer) {
        if (answer.choice === "Shop all") {
            read(func);
        }
        else if (answer.choice === "Search for item") {
            inquirer.prompt(
                {
                    name: "id",
                    message: "What is the ID of the item you would like to search for?",
                    validate: validateID
                }
            ).then(function (ans) {
                read(preprompt, ans.id);
            })
        }
        else if (answer.choice === "Quit") {
            console.log(divider);
            console.log("\t    Thank you, come back soon!");
            console.log(divider);
            connection.end();
        }
    })
}

//purchase options
function prompt() {
    inquirer.prompt([
        {
            name: 'itemid',
            message: 'What is the id of the product you would like to purchase?',
            validate: validateID
        },
        {
            name: 'quantity',
            message: 'How many would you like to purchase?',
            validate: validateTest
        }
    ]).then(function (answers) {
        confirm(answers.quantity, answers.itemid);
        // resetstock(answers.quantity, answers.itemid);
    })
}

//displays a particular id if they input one, or shows all
function read(func, id) {
    if (id) {
        var select = `SELECT * FROM products WHERE item_id = ?`;
        connection.query(select, [id], function (err, result) {
            if (err) throw err;
            if (result === null) {
                console.log("Sorry, that item doesn't exist :(");
            }
            else {
                var left = Number(result[0].stock_quantity);
                var price = parseFloat(result[0].price).toFixed(2);
                console.log(divider);
                console.log(`ID: \t\t${result[0].item_id}`);
                console.log(`Item: \t\t${result[0].product_name}`);
                console.log(`Price \t\t${format(price)}`);
                if (left <= 0) {
                    console.log(`Out of stock`);
                }
                else {
                    console.log(`In stock: \t${left}`);
                }
                console.log(`Department: \t${result[0].department_name}`)
                console.log(divider);
                inquirer.prompt([{
                    name: "ask",
                    message: "Would you like to purchase this item?",
                    type: "list",
                    choices: ["Yes", "No thanks"]
                }
                ]).then(function (choice) {
                    if (choice.ask === "Yes") {
                        inquirer.prompt(
                            {
                                name: 'quantity',
                                message: 'How many would you like to purchase?',
                                validate: validateTest
                            }
                        ).then(function (q) {
                            confirm(q.quantity, id, prompt);
                        })
                    }
                    else if (choice.ask === "No thanks") {
                        keepgoing();
                    }
                })
            }
        });
    }
    else {
        connection.query('SELECT * FROM products', function (err, result) {
            products = result.length;
            if (err) throw err;
            console.log(divider);
            result.forEach(function (x, i) {
                var left = Number(result[i].stock_quantity);
                var price = parseFloat(result[i].price).toFixed(2);
                console.log(`ID: \t\t${result[i].item_id}`);
                console.log(`Item: \t\t${result[i].product_name}`);
                console.log(`Price \t\t${format(price)}`);
                if (left <= 0) {
                    console.log(`Out of stock`.red);
                }
                else {
                    console.log(`In stock: \t${left}`);
                }
                console.log(`Department: \t${result[i].department_name}`)
                console.log(divider);
            });
            func();
        });
    }
}

//checks to see if the number is greater than 0
function validateID(value) {
    if (isNaN(value) === false) {
        if (Number(value) <= 0 || Number(value) > products) {
            return "Please enter a valid ID.".red;
        } 
        else {
            return true;
        }
    } else if (isNaN(value)) {
        return "Please enter a number.".red;
    }
}

function validateTest(value) {
    if (isNaN(value) === false) {
        if (Number(value) <= 0) {
            return "Please enter a number greater than 0.".red;
        } else {
            return true;
        }
    } else if (isNaN(value)) {
        return "Please enter a number.".red;
    }
}

//before a purchase is made, asks user to confirm
//func being passed is prompt for later
function confirm(q, id) {
    var select = `SELECT * FROM products WHERE item_id = ?`;
    connection.query(select, [id], function (err, result) {
        if (err) throw err;
        var price = parseFloat(q * result[0].price).toFixed(2);
        var tax = parseFloat(price * 0.06).toFixed(2);
        var total = parseFloat(price * 1.06).toFixed(2);
        console.log(divider);
        console.log("Order Summary:\n");
        console.log(`Item: \t\t${result[0].product_name}\n`)
        console.log(`Quantity: \t${q}\n`);
        console.log(`Amount: \t${format(price)}\n`);
        console.log(`Tax: \t\t${format(tax)}\n`);
        console.log(`Total: \t\t${format(total)}`);
        console.log(divider);
        inquirer.prompt(
            {
                name: "confirm",
                message: "Confirm your purchase:",
                type: "list",
                choices: ['Place Order', 'Cancel']
            }
        ).then(function (answer) {
            if (answer.confirm === 'Place Order') {
                update(q, id);
            }
            else if (answer.confirm === "Cancel") {
                keepgoing();
            }
        })
    });
}

//Updates the quantity in the database
function update(quantity, id) {
    var update = `UPDATE products SET stock_quantity = ?, product_sales = ? WHERE item_id = ?`;
    var select = `SELECT * FROM products WHERE item_id = ?`;
    connection.query(select, [id], function (err, result) {
        if (err) throw err;
        var sales = result[0].product_sales
        var stock = result[0].stock_quantity;
        var remaining = result[0].stock_quantity -= quantity;
        var sum = result[0].price * quantity;
        var newNum = sales += sum;
        var total = parseFloat(sum * 1.06).toFixed(2);
        if (stock > 0) {
            if (remaining < 0) {
                console.log(divider);
                console.log("Insufficient stock; unable to complete purchase");
                console.log(divider);
                keepgoing();
            }
            else {
                connection.query(update, [remaining, newNum, id], function (err) {
                    if (err) throw err;
                    console.log(divider);
                    console.log("Thank you for your purchase!\n".green);
                    console.log("Your order is on it's way!\n")
                    console.log(`Total: \t\t${format(total)}`);
                    console.log(divider);
                    keepgoing();
                });
            }
        }
        else {
            console.log(divider);
            console.log(`Out of stock`);
            console.log(divider);
            keepgoing();
        }
    });
}

//Asks the user if they would like to keep shopping
function keepgoing() {
    inquirer.prompt([
        {
            name: "action",
            message: "Would you like to continue shopping?",
            type: "list",
            choices: ["Yes", "No"]
        }
    ]).then(function (answer) {
        if (answer.action === "Yes") {
            read(prompt);
        }
        else if (answer.action === "No") {
            console.log(divider);
            console.log("\t    Thank you, come back soon!".cyan);
            console.log(divider);
            connection.end();
        }
    })
}