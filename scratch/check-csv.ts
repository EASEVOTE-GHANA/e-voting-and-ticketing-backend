import mongoose from "mongoose";

const schema = new mongoose.Schema({
  name: String,
  nested: {
    field: String
  }
});
const Model = mongoose.model('TestCsv', schema);

const doc = new Model({ name: "jimmy", nested: { field: "value" } });

const item = doc;
const key = "nested.field";
const val = key.split('.').reduce((obj: any, k) => obj?.[k], item);
console.log("Direct access:", val);

const itemObj = doc.toObject();
const valObj = key.split('.').reduce((obj: any, k) => obj?.[k], itemObj);
console.log("toObject access:", valObj);

