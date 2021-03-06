
var pg = require('pg');
var DogeAPI = require('dogeapi');
var content = require('../content.json');
var databaseConfig = require('../database.json');

var dogeAPI = new DogeAPI({
							apikey: content.settings.doge_api_key,
							endpoint: 'https://dogeapi.com/'
						});

console.log("STARTING VALIDATOR");

// Postgres Setup
var postgres_client = new pg.Client(process.env.DATABASE_URL || databaseConfig.dev);

postgres_client.connect(function(err) {

	if(err) {
		console.log('could not connect to postgres', err);
		return;
	}

	console.log("grabbing pledges to validate from DB");

	postgres_client.query('SELECT * FROM pledges WHERE validated = false LIMIT 500',function(error, result) {
		if(error) {
			console.log(error);
		} else {
			for (var i=0; i<result.rows.length; i++) {

				var address = result.rows[i]["wallet_address"];
				var id = result.rows[i]["id"];
				var amount = result.rows[i]["amount"];

				validateRow(id,address,amount,(i==result.rows.length-1));
			}
		}
	});

});

function validateRow(id,address,amount,disconnectOnEnd) {

	dogeAPI.getAddressReceived(address, null, function (error, response) {

		if (error) {
			console.log("Error validating wallet ("+address+"): "+error);
		} else {
			var amount_received = JSON.parse(response)["data"]["received"];
			console.log("validated amount for address ("+address+") = "+amount_received+" ... matches amount "+amount+" = "+(amount_received == amount)+" for id:"+id);
			if (amount_received != undefined) {
				postgres_client.query('UPDATE pledges SET validated_wallet_amount=$1 WHERE id=$2 RETURNING id', [amount_received,id],function(err, result) {
					if (err) {
						console.log("Error updating DB: "+error);
					}
				});
				if (disconnectOnEnd) {
					// console.log("DONE... Disconnecting from DB");
					// postgres_client.end();
				}
			}
		}

	});
}