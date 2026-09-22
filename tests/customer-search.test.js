jest.mock("mysql2/promise", () => ({
    createConnection: jest.fn()
}));

const mysql = require("mysql2/promise");
const request = require("supertest");
const app = require("../app/server");

describe("Customer Search Feature", () => {

    test("should search customers by name", async () => {

        const mockConnection = {
            execute: jest.fn().mockResolvedValue([
                [
                    {
                        id: 1,
                        name: "John Doe",
                        email: "john@example.com"
                    },
                    {
                        id: 3,
                        name: "John Williams",
                        email: "john.williams@example.com"
                    }
                ]
            ]),
            end: jest.fn().mockResolvedValue()
        };

        mysql.createConnection.mockResolvedValue(mockConnection);

        const response = await request(app)
            .get("/customers/search?name=John");

        expect(response.statusCode).toBe(200);

        expect(response.body.search).toBe("John");

        expect(response.body.customers).toHaveLength(2);

        expect(response.body.customers[0].name).toBe("John Doe");

        expect(response.body.customers[1].name).toBe("John Williams");

        expect(mockConnection.execute).toHaveBeenCalled();

        expect(mockConnection.end).toHaveBeenCalled();
    });

});